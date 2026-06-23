variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "discord_token" {
  description = "Discord bot authentication token"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_base_url" {
  description = "OpenAI-compatible API base URL"
  type        = string
  default     = ""
}

variable "ollama_url" {
  description = "Ollama server URL"
  type        = string
  default     = ""
}

variable "default_provider" {
  description = "Default AI provider"
  type        = string
  default     = "gemini"
}

variable "text_model" {
  description = "Text model to use"
  type        = string
  default     = "gemini-2.0-flash"
}

variable "vision_model" {
  description = "Vision model to use"
  type        = string
  default     = "gemini-1.5-flash"
}

variable "loki_url" {
  description = "Loki logging URL"
  type        = string
  default     = "http://loki:3100"
}

variable "redis_storage_class" {
  description = "Storage class for Redis persistence"
  type        = string
}

variable "redis_subpath" {
  description = "Subpath for Redis volume mount"
  type        = string
  default     = ""
}
