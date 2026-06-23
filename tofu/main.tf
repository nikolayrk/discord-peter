provider "helm" {
  kubernetes {
    config_path = var.kubeconfig_path
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

resource "kubernetes_namespace" "discord_peter" {
  metadata {
    name = "discord-peter"
  }
}

resource "helm_release" "discord_peter" {
  name      = "discord-peter"
  chart     = "${path.module}/../charts/discord-peter"
  namespace = kubernetes_namespace.discord_peter.metadata[0].name

  set {
    name  = "image.repository"
    value = "ghcr.io/nikolayrk/discord-peter"
  }

  set {
    name  = "image.tag"
    value = var.image_tag
  }

  set_sensitive {
    name  = "secrets.discordToken"
    value = var.discord_token
  }

  set_sensitive {
    name  = "secrets.geminiApiKey"
    value = var.gemini_api_key
  }

  set_sensitive {
    name  = "secrets.openaiApiKey"
    value = var.openai_api_key
  }

  set {
    name  = "config.defaultProvider"
    value = var.default_provider
  }

  set {
    name  = "config.textModel"
    value = var.text_model
  }

  set {
    name  = "config.visionModel"
    value = var.vision_model
  }

  set {
    name  = "config.openaiBaseUrl"
    value = var.openai_base_url
  }

  set {
    name  = "config.ollamaUrl"
    value = var.ollama_url
  }

  set {
    name  = "config.lokiUrl"
    value = var.loki_url
  }

  set {
    name  = "redis.master.persistence.enabled"
    value = "true"
  }

  set {
    name  = "redis.master.persistence.storageClass"
    value = var.redis_storage_class
  }

  set {
    name  = "redis.master.persistence.size"
    value = "1Gi"
  }

  set {
    name  = "redis.master.volumePermissions.enabled"
    value = "true"
  }

  set {
    name  = "redis.master.persistence.subPath"
    value = var.redis_subpath
  }
}
