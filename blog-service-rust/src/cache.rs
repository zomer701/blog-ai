use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Simple in-memory cache with TTL support
pub struct Cache<T> {
    data: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    ttl: Duration,
}

struct CacheEntry<T> {
    value: T,
    expires_at: Instant,
}

impl<T: Clone> Cache<T> {
    /// Create a new cache with specified TTL in seconds
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
            ttl: Duration::from_secs(ttl_seconds),
        }
    }
    
    /// Get value from cache if it exists and hasn't expired
    pub async fn get(&self, key: &str) -> Option<T> {
        let cache = self.data.read().await;
        if let Some(entry) = cache.get(key) {
            if entry.expires_at > Instant::now() {
                return Some(entry.value.clone());
            }
        }
        None
    }
    
    /// Set value in cache with TTL
    pub async fn set(&self, key: String, value: T) {
        let mut cache = self.data.write().await;
        cache.insert(key, CacheEntry {
            value,
            expires_at: Instant::now() + self.ttl,
        });
    }
    
    /// Invalidate specific cache entry
    pub async fn invalidate(&self, key: &str) {
        let mut cache = self.data.write().await;
        cache.remove(key);
    }
    
    /// Clear all cache entries
    pub async fn clear(&self) {
        let mut cache = self.data.write().await;
        cache.clear();
    }
    
    /// Remove expired entries (cleanup)
    pub async fn cleanup(&self) {
        let mut cache = self.data.write().await;
        let now = Instant::now();
        cache.retain(|_, entry| entry.expires_at > now);
    }
    
    /// Get cache size
    pub async fn size(&self) -> usize {
        let cache = self.data.read().await;
        cache.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::sleep;
    
    #[tokio::test]
    async fn test_cache_set_get() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), "value1".to_string()).await;
        
        let value = cache.get("key1").await;
        assert_eq!(value, Some("value1".to_string()));
    }
    
    #[tokio::test]
    async fn test_cache_expiration() {
        let cache = Cache::new(1); // 1 second TTL
        cache.set("key1".to_string(), "value1".to_string()).await;
        
        // Should exist immediately
        assert!(cache.get("key1").await.is_some());
        
        // Wait for expiration
        sleep(Duration::from_secs(2)).await;
        
        // Should be expired
        assert!(cache.get("key1").await.is_none());
    }
    
    #[tokio::test]
    async fn test_cache_invalidate() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), "value1".to_string()).await;
        
        assert!(cache.get("key1").await.is_some());
        
        cache.invalidate("key1").await;
        
        assert!(cache.get("key1").await.is_none());
    }
    
    #[tokio::test]
    async fn test_cache_clear() {
        let cache = Cache::new(60);
        cache.set("key1".to_string(), "value1".to_string()).await;
        cache.set("key2".to_string(), "value2".to_string()).await;
        
        assert_eq!(cache.size().await, 2);
        
        cache.clear().await;
        
        assert_eq!(cache.size().await, 0);
    }
}
