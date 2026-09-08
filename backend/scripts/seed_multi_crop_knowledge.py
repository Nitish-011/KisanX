import os
from typing import Any, Dict, List

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "").strip()
if not SUPABASE_SECRET_KEY:
    SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is not configured.")
if not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY is not configured.")

supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

print("=" * 70)
print("Loading KisanX embedding model...")
print("Model: sentence-transformers/all-MiniLM-L6-v2")
print("=" * 70)

embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
print("Embedding model loaded.")
print()

ALL_KNOWLEDGE_RECORDS: List[Dict[str, Any]] = [
    # ============================================================
    # SUGARCANE (ICAR)
    # ============================================================
    {
        "title": "Sugarcane Red Rot: disease symptoms and identification",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/2022-04/ICAR-News-October-December-2018.pdf",
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Red rot is an important disease of sugarcane caused by Colletotrichum falcatum. "
            "Symptoms include yellowing and drooping of upper leaves, reddening of internal pith "
            "tissues with diagnostic cross-wise white patches, and alcoholic or sour smell when "
            "the stalk is split open. Field inspection should include checking plants for "
            "characteristic disease symptoms and removing clearly infected plants from the field."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "RedRot", "topic": "identification", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Red Rot: affected plants and field sanitation",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "For management of red rot in sugarcane, affected plants should be immediately rogued "
            "and burnt to prevent secondary spread. Field sanitation and use of healthy disease-free "
            "planting setts are vital. Avoid taking ratoon crops from infected fields and disinfect "
            "cutting implements between plots."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "RedRot", "topic": "management", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Red Rot: healthy planting material and sett selection",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/en/farmers-participatory-quality-seed-production-sugarcane-organised",
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Use of certified disease-free sugarcane seed setts from designated seed nurseries "
            "greatly reduces red rot incidence. Farmers should discard setts showing reddish discoloration "
            "at cut ends. Hot water treatment (52°C for 30 minutes) or moist hot air treatment of setts "
            "destroys internal mycelium prior to planting."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "RedRot", "topic": "prevention", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Red Rot: water management and drainage risk",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "Waterlogging and poorly drained heavy soils significantly aggravate red rot dissemination "
            "via irrigation channels. Ensure proper field drainage channels to evacuate excess monsoon "
            "water. Avoid flow irrigation from infected fields into healthy fields."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "RedRot", "topic": "field-management", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Red Rot: ratoon crop management",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "RedRot",
        "language": "en",
        "content": (
            "In fields with more than 5 percent red rot incidence, farmers should strictly avoid "
            "taking ratoon crops. Stubble should be uprooted and burnt, followed by deep summer ploughing "
            "and rotation with green manure crops like dhaincha or sunnhemp before replanting."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "RedRot", "topic": "crop-management", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Mosaic: cause and symptoms",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/2022-04/ICAR-News-October-December-2018.pdf",
        "crop": "Sugarcane",
        "disease": "Mosaic",
        "language": "en",
        "content": (
            "Sugarcane mosaic is caused by Sugarcane mosaic virus (SCMV) or Sugarcane streak mosaic virus (SCSMV). "
            "Symptoms show irregular alternating dark and light green patches or elongated chlorotic streaks "
            "on leaf blades, particularly prominent on younger leaves in the spindle."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Mosaic", "topic": "identification", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Mosaic: prevention through healthy planting material",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/2022-04/ICAR-News-October-December-2018.pdf",
        "crop": "Sugarcane",
        "disease": "Mosaic",
        "language": "en",
        "content": (
            "Management of sugarcane mosaic requires using meristem-derived, virus-indexed tissue culture "
            "plantlets. Roguing infected clumps early in the crop cycle prevents aphid transmission. "
            "Keep field borders clear of wild grass weed hosts that harbor mosaic viruses."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Mosaic", "topic": "prevention", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Yellow Leaf Disease: symptoms",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/2022-04/ICAR-News-October-December-2018.pdf",
        "crop": "Sugarcane",
        "disease": "Yellow",
        "language": "en",
        "content": (
            "Sugarcane yellow leaf disease is associated with Sugarcane yellow leaf virus (SCYLV). "
            "A characteristic symptom is prominent yellowing along the midrib on the lower surface of leaves "
            "3 to 6 from the top, gradually spreading to the leaf blade followed by necrosis of leaf tips."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Yellow", "topic": "identification", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Yellow Leaf Disease: planting material and aphid transmission",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/2022-04/ICAR-News-October-December-2018.pdf",
        "crop": "Sugarcane",
        "disease": "Yellow",
        "language": "en",
        "content": (
            "The yellow leaf virus is transmitted through infected setts and by the sugarcane aphid "
            "(Melanaphis sacchari). Use disease-free planting material derived through tissue culture, "
            "monitor aphid vectors in early crop growth, and rogue out severely symptomatic clumps."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Yellow", "topic": "prevention", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Rust: identification and symptoms",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "Rust",
        "language": "en",
        "content": (
            "Sugarcane common rust caused by Puccinia melanocephala manifests as small, elongated, "
            "yellowish spots on both surfaces of leaves, rapidly turning reddish-brown to dark brown "
            "pustules (uredia) that erupt through the epidermis releasing powdery orange-brown spores."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Rust", "topic": "identification", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Rust: ICAR management guidance",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "Rust",
        "language": "en",
        "content": (
            "For managing sugarcane rust when pustules first appear during cool, humid conditions, "
            "ICAR recommends foliar fungicide sprays such as Mancozeb 75 WP (2.0 g/L) or Propiconazole 25 EC (1.0 ml/L). "
            "Avoid excessive nitrogen fertilization which creates succulent foliage highly prone to rust infection."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Rust", "topic": "management", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Crop Health: agronomic maintenance and yield optimization",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "Healthy",
        "language": "en",
        "content": (
            "Healthy sugarcane crops require balanced nutrition based on soil test values (recommended NPK 250:100:120 kg/ha). "
            "Perform earthing-up operations at 90 and 120 days to prevent lodging and promote root anchoring. "
            "Apply trash mulching to conserve moisture and suppress early weeds. Maintain regular irrigation during "
            "tillering and grand growth phases."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Healthy", "topic": "agronomy", "authority": "ICAR"},
    },
    {
        "title": "Sugarcane Field Scouting: routine monitoring guidelines",
        "source_name": "ICAR",
        "source_url": "https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf",
        "crop": "Sugarcane",
        "disease": "Healthy",
        "language": "en",
        "content": (
            "Farmers should perform weekly field scouting across representative rows. Monitor early shoot borer "
            "(Chilo infuscatellus) deadhearts during early vegetative stages, inspect spindle leaves for sucking pests "
            "like pyrilla or whitefly, and ensure furrows have good drainage to maintain vigorous root aeration."
        ),
        "metadata": {"crop": "Sugarcane", "disease": "Healthy", "topic": "scouting", "authority": "ICAR"},
    },

    # ============================================================
    # COTTON (ICAR-CICR)
    # ============================================================
    {
        "title": "Cotton Bacterial Blight: ICAR-CICR Diagnostic Symptoms",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/bacterial_blight_advisory.pdf",
        "crop": "Cotton",
        "disease": "Bacterial blight",
        "language": "en",
        "content": (
            "Bacterial blight of cotton (caused by Xanthomonas citri pv. malvacearum) produces four distinct phases: "
            "seedling blight, angular leaf spot, black arm on branches, and boll rot. On leaves, symptoms appear "
            "as small, angular water-soaked translucent lesions bounded by veinlets, which rapidly turn brown and black. "
            "On stems and petioles, elongated dark lesions ('black arm') cause girdling and branch snapping."
        ),
        "metadata": {"crop": "Cotton", "disease": "Bacterial blight", "topic": "identification", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Bacterial Blight: ICAR-CICR Management and Chemical Control",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/bacterial_blight_management.pdf",
        "crop": "Cotton",
        "disease": "Bacterial blight",
        "language": "en",
        "content": (
            "For chemical management of bacterial blight, ICAR-CICR recommends spraying Copper Oxychloride 50 WP "
            "(25-30 g in 10 L of water) mixed with Streptocycline (1 g in 10 L of water) or Agrimycin-100 at the first "
            "appearance of angular water-soaked leaf spots. Repeat the spray after 12 to 15 days if cloudy, humid weather "
            "and rainfall persist. Seed acid delinting with concentrated sulfuric acid (100 ml/kg seed) eradicates seed-borne inoculum."
        ),
        "metadata": {"crop": "Cotton", "disease": "Bacterial blight", "topic": "management", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Bacterial Blight: Cultural Sanitation and Prevention",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_disease_calendar.pdf",
        "crop": "Cotton",
        "disease": "Bacterial blight",
        "language": "en",
        "content": (
            "Preventive cultural practices for cotton bacterial blight include destroying infected plant residues and stubbles "
            "immediately after harvest. Avoid overhead sprinkler irrigation during warm, humid conditions as splash droplets "
            "spread Xanthomonas bacteria rapidly. Maintain balanced nitrogen application, as excessive vegetative lushness "
            "increases crop susceptibility to black arm infection."
        ),
        "metadata": {"crop": "Cotton", "disease": "Bacterial blight", "topic": "prevention", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Leaf Curl Virus: Symptoms and Disease Diagnosis",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_leaf_curl_advisory.pdf",
        "crop": "Cotton",
        "disease": "Leaf curl",
        "language": "en",
        "content": (
            "Cotton Leaf Curl Virus (CLCuV) is a begomovirus transmitted by the whitefly (Bemisia tabaci). "
            "Primary symptoms include upward or downward curling of leaf margins, severe vein thickening, "
            "vein enations (cup-shaped leafy outgrowths on the underside of main leaf veins), and extreme stunting "
            "of plants with poor square and boll development."
        ),
        "metadata": {"crop": "Cotton", "disease": "Leaf curl", "topic": "identification", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Leaf Curl Virus: Whitefly Vector Suppression and Chemical Advisory",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/whitefly_clcuv_strategy.pdf",
        "crop": "Cotton",
        "disease": "Leaf curl",
        "language": "en",
        "content": (
            "Controlling CLCuV relies primarily on suppressing the whitefly vector. Monitor whitefly nymphs and adults "
            "using yellow sticky traps installed at crop canopy level (8-10 per acre). If whitefly population exceeds "
            "the economic threshold level (ETL: 6-8 adults per leaf), spray Flonicamid 50 WG (0.4 g/L) or Diafenthiuron 50 WP "
            "(1.2 g/L) or Pyriproxyfen 10 EC (2.0 ml/L) as recommended by ICAR-CICR. Avoid synthetic pyrethroids which cause whitefly resurgence."
        ),
        "metadata": {"crop": "Cotton", "disease": "Leaf curl", "topic": "vector-management", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Leaf Curl Virus: Cultural Prevention and Weed Host Eradication",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/clcuv_preventive_strategy.pdf",
        "crop": "Cotton",
        "disease": "Leaf curl",
        "language": "en",
        "content": (
            "Eradicate collateral weed hosts such as Peeli Buti (Abutilon indicum), Bhakhra (Tribulus terrestris), "
            "and Solanum nigrum from field borders, bunds, and water channels before cotton sowing. Plant 2-3 rows "
            "of barrier crops like pearl millet (bajra), sorghum, or maize around cotton fields to reduce whitefly drift. "
            "Rogue out and bury virus-infected plants within 45 days after sowing."
        ),
        "metadata": {"crop": "Cotton", "disease": "Leaf curl", "topic": "prevention", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Aphids: Identification and Infestation Symptoms",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_aphids_ipm.pdf",
        "crop": "Cotton",
        "disease": "Aphids",
        "language": "en",
        "content": (
            "Cotton aphid (Aphis gossypii) is a soft-bodied sucking insect found in colonies on the underside of young leaves "
            "and growing shoots. Nymphs and adults suck plant sap, leading to downward curling and crinkling of leaves, "
            "stunted growth, and premature leaf drop. Aphids secrete abundant sticky honeydew, encouraging sooty mold "
            "(Capnodium spp.) that coats leaves with black fungus and impairs photosynthesis."
        ),
        "metadata": {"crop": "Cotton", "disease": "Aphids", "topic": "identification", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Aphids: Integrated Pest Management and Biological Control",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_ipm_guidelines.pdf",
        "crop": "Cotton",
        "disease": "Aphids",
        "language": "en",
        "content": (
            "Conserve natural bio-control agents such as ladybird beetles (Coccinella septempunctata), syrphid fly maggots, "
            "and green lacewing larvae (Chrysoperla carnea). In early stages, spray Neem Seed Kernel Extract (NSKE 5%) or "
            "Azadirachtin 10000 ppm (1.0 ml/L) to deter feeding. Erection of yellow sticky traps (10 per acre) assists in monitoring."
        ),
        "metadata": {"crop": "Cotton", "disease": "Aphids", "topic": "biological-control", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Aphids: Chemical Spray Recommendations and ETL",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_chemical_advisories.pdf",
        "crop": "Cotton",
        "disease": "Aphids",
        "language": "en",
        "content": (
            "Initiate chemical sprays only when aphid populations breach the Economic Threshold Level (ETL: 10% affected plants "
            "or 15-20 aphids per leaf). ICAR-CICR recommended systemic options include Flonicamid 50 WG (0.4 g/L) or "
            "Thiamethoxam 25 WG (0.2 g/L) or Acetamiprid 20 SP (0.2 g/L). Ensure uniform canopy spray coverage, especially on lower leaf undersides."
        ),
        "metadata": {"crop": "Cotton", "disease": "Aphids", "topic": "chemical-control", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Army Worm: Identification and Larval Damage",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_spodoptera_bulletin.pdf",
        "crop": "Cotton",
        "disease": "Army worm",
        "language": "en",
        "content": (
            "Army worm (Spodoptera litura and Fall Armyworm Spodoptera frugiperda) is a destructive polyphagous pest. "
            "Young larvae feed gregariously on the underside of leaves, skeletonizing them into papery white patches. "
            "Older solitary instars voraciously defoliate plants, feed on flower buds (squares), and bore into developing bolls "
            "creating large irregular feeding cavities contaminated with moist fecal pellets."
        ),
        "metadata": {"crop": "Cotton", "disease": "Army worm", "topic": "identification", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Army Worm: Monitoring and Mechanical Control",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/spodoptera_management_cicr.pdf",
        "crop": "Cotton",
        "disease": "Army worm",
        "language": "en",
        "content": (
            "Install pheromone traps (5 traps per acre) baited with Spodolure to monitor adult moth activity. "
            "Erect 10 to 15 bird perches per acre to encourage predatory insectivorous birds. Hand-pick and destroy "
            "visible golden egg masses covered with hair scales and skeletonized leaves containing gregarious young larvae."
        ),
        "metadata": {"crop": "Cotton", "disease": "Army worm", "topic": "mechanical-control", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Army Worm: Biological Control and ICAR-CICR Spray Advisory",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/spodoptera_chemical_spray.pdf",
        "crop": "Cotton",
        "disease": "Army worm",
        "language": "en",
        "content": (
            "For early instars, spray Bacillus thuringiensis (Bt) formulations (1.5-2.0 kg/ha) or Spodoptera Nuclear Polyhedrosis "
            "Virus (SlNPV 250 LE/ha) during evening hours. For advanced larval infestations, apply poison baiting using 10 kg rice bran, "
            "1 kg jaggery, and 100 ml Chlorpyrifos or 100 g Thiodicarb rolled into small balls and placed in furrows at dusk. "
            "Targeted foliar sprays include Chlorantraniliprole 18.5 SC (0.3 ml/L) or Emamectin Benzoate 5 SG (0.5 g/L)."
        ),
        "metadata": {"crop": "Cotton", "disease": "Army worm", "topic": "management", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Fusarium Wilt: Symptoms and Diagnostic Identification",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_fusarium_wilt.pdf",
        "crop": "Cotton",
        "disease": "Fusarium wilt",
        "language": "en",
        "content": (
            "Fusarium wilt caused by the soil-borne fungus Fusarium oxysporum f. sp. vasinfectum affects cotton plants at all stages. "
            "Initial symptoms show loss of leaf turgidity, yellowing of leaf veins, and marginal necrosis starting from lower leaves. "
            "Plants wilt and shed leaves, retaining only bare stems. Diagnostic field confirmation is obtained by splitting the taproot "
            "and main stem longitudinally to reveal a dark brown to black ring of vascular discoloration in the xylem."
        ),
        "metadata": {"crop": "Cotton", "disease": "Fusarium wilt", "topic": "identification", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Fusarium Wilt: Soil Bio-Control and Organic Amendments",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/fusarium_biocontrol_advisory.pdf",
        "crop": "Cotton",
        "disease": "Fusarium wilt",
        "language": "en",
        "content": (
            "Because Fusarium is soil-borne, biological protection is essential. Apply bio-agent Trichoderma viride or "
            "Trichoderma harzianum (2.5 kg/ha mixed with 100 kg well-decomposed farmyard manure) incubated in shade for 7 days "
            "before soil application at sowing. Treat seed with Trichoderma (10 g/kg seed) or Pseudomonas fluorescens (10 g/kg seed). "
            "Avoid root injury during tractor hoeing to prevent pathogen entry."
        ),
        "metadata": {"crop": "Cotton", "disease": "Fusarium wilt", "topic": "biological-control", "authority": "ICAR-CICR"},
    },
    {
        "title": "Cotton Fusarium Wilt: Cultural Rotation and Preventive Management",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_wilt_rotation_strategy.pdf",
        "crop": "Cotton",
        "disease": "Fusarium wilt",
        "language": "en",
        "content": (
            "Strictly avoid monoculture cotton in wilt-sick soils. Practice 3-year crop rotation with non-host cereals like sorghum, "
            "pearl millet, or maize. Conduct deep summer ploughing to expose fungal chlamydospores to intense solar radiation. "
            "Ensure field leveling and effective surface drainage to prevent waterlogging which severely accelerates wilt progression."
        ),
        "metadata": {"crop": "Cotton", "disease": "Fusarium wilt", "topic": "prevention", "authority": "ICAR-CICR"},
    },
    # Alias record for model label spelling 'Fuserium wilt'
    {
        "title": "Cotton Fuserium Wilt: Diagnostic Guidance and Agronomic Protocol",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_fusarium_wilt.pdf",
        "crop": "Cotton",
        "disease": "Fuserium wilt",
        "language": "en",
        "content": (
            "Fuserium (Fusarium) vascular wilt is diagnosed by xylem vascular browning in split stems and sudden wilting of foliage. "
            "Seed biopriming with Trichoderma, balanced fertilization avoiding high nitrogen, and non-host crop rotation "
            "are the primary management protocols recommended by ICAR-CICR."
        ),
        "metadata": {"crop": "Cotton", "disease": "Fuserium wilt", "topic": "management", "authority": "ICAR-CICR"},
    },
    {
        "title": "Healthy Cotton Management: Agronomic Monitoring and Balanced Nutrition",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_good_agricultural_practices.pdf",
        "crop": "Cotton",
        "disease": "Healthy",
        "language": "en",
        "content": (
            "A healthy cotton crop exhibits robust vegetative vigor, dark green symmetrical leaves, and active square formation. "
            "Maintain balanced nutrient application based on soil testing (recommended NPK ratio 120:60:60 kg/ha for Bt hybrids). "
            "Foliar spray of 1-2% Potassium Nitrate (13:0:45) or Magnesium Sulphate (1%) during flowering and boll development "
            "prevents square shedding and improves boll weight."
        ),
        "metadata": {"crop": "Cotton", "disease": "Healthy", "topic": "agronomy", "authority": "ICAR-CICR"},
    },
    {
        "title": "Healthy Cotton Canopy and Water Management: Good Agricultural Practices",
        "source_name": "ICAR-CICR",
        "source_url": "https://cicr.icar.gov.in/cotton_irrigation_advisory.pdf",
        "crop": "Cotton",
        "disease": "Healthy",
        "language": "en",
        "content": (
            "Practice alternate furrow irrigation or drip irrigation to ensure moisture without waterlogging. "
            "The critical irrigation stages are flowering, square formation, and boll development. Ensure prompt weed management "
            "during the initial 60 days to prevent competition for nutrients and solar radiation."
        ),
        "metadata": {"crop": "Cotton", "disease": "Healthy", "topic": "irrigation", "authority": "ICAR-CICR"},
    },
]


def build_embedding_text(record: Dict[str, Any]) -> str:
    return "\n".join(
        [
            f"Title: {record['title']}",
            f"Crop: {record['crop']}",
            f"Disease: {record['disease']}",
            f"Topic: {record['metadata'].get('topic', '')}",
            f"Content: {record['content']}",
        ]
    )


def create_embedding(text: str) -> List[float]:
    embedding = embedding_model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def main() -> None:
    print("=" * 70)
    print("SEEDING COMPLETE MULTI-CROP KNOWLEDGE BASE (SUGARCANE & COTTON)")
    print("=" * 70)
    print(f"Total canonical records to seed: {len(ALL_KNOWLEDGE_RECORDS)}")
    print()

    prepared_records = []
    for index, record in enumerate(ALL_KNOWLEDGE_RECORDS, start=1):
        print(f"[{index}/{len(ALL_KNOWLEDGE_RECORDS)}] Embedding: [{record['crop']}] {record['disease']} - {record['title']}")
        embedding_text = build_embedding_text(record)
        embedding = create_embedding(embedding_text)
        prepared_records.append({**record, "embedding": embedding})

    print()
    print("Embeddings generated.")
    print("Upserting records into Supabase table 'knowledge_documents'...")

    response = (
        supabase
        .table("knowledge_documents")
        .upsert(
            prepared_records,
            on_conflict="title,source_name,source_url,disease,language",
        )
        .execute()
    )

    processed = response.data or []
    print("=" * 70)
    print("SEED COMPLETE")
    print("=" * 70)
    print(f"Records upserted successfully: {len(processed)}")
    print()


if __name__ == "__main__":
    main()
