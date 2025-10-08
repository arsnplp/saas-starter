# Search & Company Data

## Search Companies
**POST** `/v1/data/search/companies` — **1 crédit / 10 résultats**  
**But** : chercher des Pages entreprises (filtres avancés).  
**Body** : `keyword` (req, string **ou** array), `industry?`, `location?`, `employee_range?`, `founding_company?` (bool), `total_results`

## Company Info (by URL)
**POST** `/v1/data/company/info` — **1 crédit / req**  
**But** : extraire les infos complètes d’une entreprise via URL LinkedIn.  
**Body** : `company_url` (req)

## Company Info by Domain
**POST** `/v1/data/company/info-by-domain` — **1 crédit / req**  
**But** : retrouver et extraire l’entreprise à partir d’un nom de **domaine**.  
**Body** : `domain` (req), ex: `stripe.com`

## Search Profiles
**POST** `/v1/data/search/profiles` — **1 crédit / 10 résultats**  
**But** : rechercher des **profils** (ICP) via critères multiples.  
**Body** : au moins un critère parmi `keyword`, `job_title`, `industry`, `school`, `location`, `current_company`. Supporte les **arrays**. `total_results` de 1 à 50 000.
