variable "account_id" {
  description = "Cloudflare account ID. Set through TF_VAR_account_id."
  type        = string
}

variable "zone_name" {
  description = "Existing zone. Terraform only reads it, it must not be created or changed here."
  type        = string
  default     = "marulabs.dev"
}

variable "hostname" {
  description = "Public hostname of the blog."
  type        = string
  default     = "blog.marulabs.dev"
}

variable "worker_name" {
  description = "Worker name. Must match `name` in wrangler.jsonc."
  type        = string
  default     = "marulabs-blog"
}

variable "database_name" {
  description = "D1 database name. Must match `database_name` in wrangler.jsonc."
  type        = string
  default     = "marulabs-blog"
}
