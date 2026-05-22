# JanuNet Architecture

## Two Parts
1. Chrome Extension (`extension/`)
2. Web Portal + API (Vercel → gen-z-dns.vercel.app)

## Storage Backends
| Backend | Code | Who manages data |
|---------|------|-----------------|
| JanuNet Default | `janunet` | Our Firestore (janunet-cloud) |
| User's Supabase | `supabase` | User's own Supabase project |
| User's Firebase | `firebase` | User's own Firebase project |

## Public URL Format (PREFIX-BASED)
JanuNet Default:
gen-z-dns.vercel.app/u/{username}/{domainname}
Example: gen-z-dns.vercel.app/u/shaikjanu/aijulie.com
Server: reads from janunet-cloud Firestore by username

User Supabase:
gen-z-dns.vercel.app/s/{supabase-project-ref}/{domainname}
Example: gen-z-dns.vercel.app/s/sujijdfbknzennfcnobf/julie.ai
Server: reads anon key from our DB by project-ref, queries user's Supabase

User Firebase:
gen-z-dns.vercel.app/f/{firebase-project-id}/{domainname}
Example: gen-z-dns.vercel.app/f/janunet-cloud/testbyos.student
Server: queries that Firebase project directly (Firestore is public-read)

￼
BASH
￼▶ Run

## Vercel Routes
/u/:username/:domain  → api/domain?backend=janunet&username=:username&domain=:domain
/s/:ref/:domain       → api/domain?backend=supabase&ref=:ref&domain=:domain
/f/:projectId/:domain → api/domain?backend=firebase&projectId=:projectId&domain=:domain
/api/(.*)             → api/$1

￼
BASH
￼▶ Run

## Extension Workspace
- Default: queries JanuNet Firestore directly
- Supabase: user sets Supabase URL + anon key in extension workspace settings
- Firebase: user sets Firebase project ID in extension workspace settings
- Config stored in chrome.storage.local (never leaves device)

## Portal Workspace
- User sets backend in Workspace tab
- Encrypted config saved to janu_users/{uid}.workspaceConfig
- Public backend info saved to janu_users/{uid} fields:
  - publicBackend, publicSupabaseUrl, publicSupabaseAnonKey, publicFirestoreProjectId
- Notifies extension via chrome.runtime.sendMessage on save

## Share URL generation
- Portal domain cards: generate correct prefix URL based on active workspace
- Extension viewer Share button: reads chrome.storage.local workspace to pick prefix

## Supabase credential lookup for /s/ URLs
- Server receives Supabase project ref from URL
- Looks up anon key in our Firestore: janu_users where supabaseRef = ref
- Uses anon key to query user's Supabase
- Anon key is public by design (secured by RLS policies)

## Files
api/domain.js          → handles all three public URL routes
api/workspace.js       → save/load encrypted workspace config
api/resolve.js         → extension domain resolution (JanuNet default)
api/scan-domain.js     → AI safety scan before registration
api/domains.js         → list all domains for autocomplete
public/index.html      → portal (auth, dashboard, workspace tab)
public/lib/storage/    → StorageAdapter, FirestoreAdapter, SupabaseAdapter
public/lib/crypto.js   → AES-256-GCM encryption for workspace credentials
extension/panel.*      → sidepanel UI (recents, favorites, autocomplete)
extension/viewer.*     → browser-style viewer with share modal
extension/background.js → service worker (omnibox, version check, messaging)
extension/workspace.*  → extension workspace settings page

￼
BASH
￼▶ Run
