use axum::{
    extract::{Request, State},
    http::{StatusCode, HeaderMap},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, decode_header, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use std::collections::HashMap;

#[derive(Clone)]
pub struct CognitoAuth {
    user_pool_id: String,
    region: String,
    jwks: HashMap<String, DecodingKey>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: Option<String>,
    #[serde(rename = "cognito:username")]
    pub cognito_username: Option<String>,
    pub exp: usize,
    pub iat: usize,
}

impl CognitoAuth {
    pub async fn new(user_pool_id: String, region: String) -> Result<Self> {
        let mut auth = Self {
            user_pool_id,
            region,
            jwks: HashMap::new(),
        };
        
        // Fetch JWKS from Cognito
        auth.refresh_jwks().await?;
        
        Ok(auth)
    }
    
    async fn refresh_jwks(&mut self) -> Result<()> {
        let jwks_url = format!(
            "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
            self.region, self.user_pool_id
        );
        
        let response = reqwest::get(&jwks_url).await?;
        let jwks: serde_json::Value = response.json().await?;
        
        if let Some(keys) = jwks["keys"].as_array() {
            for key in keys {
                if let (Some(kid), Some(n), Some(e)) = (
                    key["kid"].as_str(),
                    key["n"].as_str(),
                    key["e"].as_str(),
                ) {
                    let decoding_key = DecodingKey::from_rsa_components(n, e)?;
                    self.jwks.insert(kid.to_string(), decoding_key);
                }
            }
        }
        
        Ok(())
    }
    
    pub fn verify_token(&self, token: &str) -> Result<Claims> {
        // Decode header to get kid
        let header = decode_header(token)?;
        let kid = header.kid.context("No kid in token header")?;
        
        // Get decoding key
        let decoding_key = self.jwks.get(&kid)
            .context("Unknown kid")?;
        
        // Verify token
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[&self.user_pool_id]);
        
        let token_data = decode::<Claims>(token, decoding_key, &validation)?;
        
        Ok(token_data.claims)
    }
}

/// Middleware to verify Cognito JWT token
pub async fn cognito_auth_middleware(
    State(state): State<super::AdminState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract Authorization header
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Extract token (Bearer <token>)
    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Verify token
    let _claims = state.cognito
        .verify_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    // Add claims to request extensions for handlers to use
    // request.extensions_mut().insert(claims);
    
    Ok(next.run(request).await)
}
