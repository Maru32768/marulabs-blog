# Responsibilities, see docs/DECISIONS.md:
#   Terraform: the Worker shell, the D1 database and the custom domain.
#   Wrangler:  code, static assets, bindings and D1 migrations.

# Read-only reference to the existing zone. Fails if the zone does not exist.
data "cloudflare_zone" "main" {
  filter = {
    name = var.zone_name
    account = {
      id = var.account_id
    }
  }
}

# The Worker without any code. `wrangler deploy` uploads versions into it.
resource "cloudflare_worker" "blog" {
  account_id = var.account_id
  name       = var.worker_name

  # Same values as `workers_dev` and `preview_urls` in wrangler.jsonc.
  subdomain = {
    enabled          = false
    previews_enabled = true
  }

  # No Workers Logs: the counter does not need request metadata stored anywhere.
  observability = {
    enabled = false
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Holds the cumulative page view count. Replacing it would lose the count.
resource "cloudflare_d1_database" "blog" {
  account_id            = var.account_id
  name                  = var.database_name
  primary_location_hint = "apac"

  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Creates and owns the proxied DNS record and the certificate for the hostname.
# There is deliberately no cloudflare_dns_record for it, that would be double management.
resource "cloudflare_workers_custom_domain" "blog" {
  account_id = var.account_id
  zone_id    = data.cloudflare_zone.main.id
  hostname   = var.hostname
  service    = cloudflare_worker.blog.name

  lifecycle {
    precondition {
      condition     = endswith(var.hostname, ".${var.zone_name}")
      error_message = "hostname must be inside the existing zone."
    }
  }
}
