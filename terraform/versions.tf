terraform {
  required_version = ">= 1.10"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }

  # State lives in a private Cloudflare R2 bucket, never in this repository.
  # The endpoint and credentials come from the environment, see .mise.ops.toml.
  backend "s3" {
    bucket                      = "marulabs-blog-tfstate"
    key                         = "terraform.tfstate"
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

# The API token comes from CLOUDFLARE_API_TOKEN, see .mise.ops.toml.
provider "cloudflare" {}
