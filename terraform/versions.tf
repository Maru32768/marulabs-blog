terraform {
  required_version = ">= 1.10"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }

  # State lives in a private Cloudflare R2 bucket, never in this repository.
  # `bucket` and `endpoints` come from backend.hcl (not committed, see backend.hcl.example).
  # Credentials come from AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (R2 token).
  backend "s3" {
    key                         = "marulabs-blog/terraform.tfstate"
    region                      = "auto"
    use_lockfile                = true
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }
}

# The API token comes from the CLOUDFLARE_API_TOKEN environment variable.
provider "cloudflare" {}
