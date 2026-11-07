output "zone_id" {
  description = "ID of the existing zone that was found."
  value       = data.cloudflare_zone.main.id
}

output "zone_status" {
  description = "Status of the existing zone, expected to be active."
  value       = data.cloudflare_zone.main.status
}

output "d1_database_id" {
  description = "Put this into database_id in wrangler.jsonc."
  value       = cloudflare_d1_database.blog.id
}

output "site_url" {
  value = "https://${var.hostname}"
}
