use anyhow::Result;
use aws_sdk_bedrockruntime::Client as BedrockClient;
use aws_sdk_bedrockruntime::primitives::Blob;
use serde_json::json;

use crate::models::{Translation, Translations};

#[allow(dead_code)]
pub struct Translator {
    bedrock: BedrockClient,
}

impl Translator {
    #[allow(dead_code)]
    pub fn new(aws_config: &aws_config::SdkConfig) -> Self {
        Self {
            bedrock: BedrockClient::new(aws_config),
        }
    }
    
    #[allow(dead_code)]
    pub async fn translate_article(&self, title: &str, content: &str) -> Result<Translations> {
        // Translate to Spanish
        let es_title = self.translate_text(title, "Spanish").await?;
        let es_content = self.translate_text(content, "Spanish").await?;
        
        // Translate to Ukrainian
        let uk_title = self.translate_text(title, "Ukrainian").await?;
        let uk_content = self.translate_text(content, "Ukrainian").await?;
        
        Ok(Translations {
            es: Translation {
                title: es_title,
                content: es_content,
                edited: false,
                edited_at: None,
            },
            uk: Translation {
                title: uk_title,
                content: uk_content,
                edited: false,
                edited_at: None,
            },
        })
    }
    
    #[allow(dead_code)]
    async fn translate_text(&self, text: &str, target_lang: &str) -> Result<String> {
        // Truncate if too long
        let text = if text.len() > 8000 {
            &text[..8000]
        } else {
            text
        };
        
        let prompt = json!({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4000,
            "messages": [{
                "role": "user",
                "content": format!(
                    "Translate the following text to {}. Maintain the original formatting and structure. Only provide the translation, no explanations:\n\n{}",
                    target_lang, text
                )
            }]
        });
        
        let response = self.bedrock
            .invoke_model()
            .model_id("anthropic.claude-3-haiku-20240307-v1:0")
            .body(Blob::new(serde_json::to_vec(&prompt)?))
            .send()
            .await?;
        
        let body = response.body().as_ref();
        let result: serde_json::Value = serde_json::from_slice(body)?;
        
        let translated = result["content"][0]["text"]
            .as_str()
            .unwrap_or(text)
            .to_string();
        
        Ok(translated)
    }
}
