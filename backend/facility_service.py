"""
Facility and Alert geospatial service for Sikkim Sentinel.
Curated dataset of disaster response authorities, hospitals, and schools across Sikkim.
"""
import math
from typing import Optional


FACILITIES = [
    # GANGTOK DISTRICT
    {
        "id": "fac-gtk-auth-1",
        "name": "State Emergency Operation Centre (SSDMA)",
        "type": "authority",
        "latitude": 27.3314,
        "longitude": 88.6138,
        "address": "Tashiling Secretariat, Gangtok",
        "district": "Gangtok",
        "contact": "1070 / 03592-202461 (Official SEOC)",
    },
    {
        "id": "fac-gtk-auth-2",
        "name": "District Disaster Management Authority (DDMA) Gangtok",
        "type": "authority",
        "latitude": 27.3389,
        "longitude": 88.6065,
        "address": "DC Office Complex, Sichey, Gangtok",
        "district": "Gangtok",
        "contact": "03592-284444 / 1077 (Official DEOC)",
    },
    {
        "id": "fac-gtk-auth-3",
        "name": "Sikkim Police Emergency Response Support System (ERSS)",
        "type": "authority",
        "latitude": 27.3278,
        "longitude": 88.6115,
        "address": "Police Headquarters, Gangtok",
        "district": "Gangtok",
        "contact": "112 / 100 (Official ERSS)",
    },
    {
        "id": "fac-gtk-hosp-1",
        "name": "STNM Multi-Speciality Hospital",
        "type": "hospital",
        "latitude": 27.3195,
        "longitude": 88.5982,
        "address": "Sochakgang, Sichey, Gangtok",
        "district": "Gangtok",
        "contact": "03592-202944 (Demo contact - Casualty)",
    },
    {
        "id": "fac-gtk-hosp-2",
        "name": "Central Referral Hospital (SMIMS / Manipal)",
        "type": "hospital",
        "latitude": 27.3090,
        "longitude": 88.6012,
        "address": "5th Mile, Tadong, Gangtok",
        "district": "Gangtok",
        "contact": "03592-270534 (Demo contact - Trauma Care)",
    },
    {
        "id": "fac-gtk-sch-1",
        "name": "Tashi Namgyal Academy (TNA)",
        "type": "school",
        "latitude": 27.3350,
        "longitude": 88.6180,
        "address": "TNA Campus, Gangtok",
        "district": "Gangtok",
        "contact": "Demo recipient (Admin Office)",
    },
    {
        "id": "fac-gtk-sch-2",
        "name": "Paljor Namgyal Girls Senior Secondary School",
        "type": "school",
        "latitude": 27.3290,
        "longitude": 88.6140,
        "address": "Baluwakhani, Gangtok",
        "district": "Gangtok",
        "contact": "Demo recipient (Principal)",
    },
    {
        "id": "fac-gtk-sch-3",
        "name": "Government Senior Secondary School, Tadong",
        "type": "school",
        "latitude": 27.3120,
        "longitude": 88.6040,
        "address": "Tadong Bazar, Gangtok",
        "district": "Gangtok",
        "contact": "Demo recipient (Principal)",
    },
    # MANGAN DISTRICT (NORTH SIKKIM)
    {
        "id": "fac-mgn-auth-1",
        "name": "District Disaster Management Authority (DDMA) Mangan",
        "type": "authority",
        "latitude": 27.5050,
        "longitude": 88.5320,
        "address": "District Administrative Complex, Pentok, Mangan",
        "district": "Mangan",
        "contact": "03592-234244 / 1077 (Official DEOC)",
    },
    {
        "id": "fac-mgn-auth-2",
        "name": "Chungthang Sub-Divisional Emergency Cell",
        "type": "authority",
        "latitude": 27.6039,
        "longitude": 88.6464,
        "address": "SDM Office, Chungthang, North Sikkim",
        "district": "Mangan",
        "contact": "03592-234012 (Official Sub-Divisional Control)",
    },
    {
        "id": "fac-mgn-auth-3",
        "name": "Lachung Quick Response Station",
        "type": "authority",
        "latitude": 27.6891,
        "longitude": 88.7433,
        "address": "Lachung Outpost, North Sikkim",
        "district": "Mangan",
        "contact": "112 / 03592-234055 (Emergency Police / SDRF)",
    },
    {
        "id": "fac-mgn-hosp-1",
        "name": "Mangan District Hospital",
        "type": "hospital",
        "latitude": 27.5080,
        "longitude": 88.5280,
        "address": "Hospital Road, Mangan",
        "district": "Mangan",
        "contact": "03592-234208 (Demo contact - Emergency Ward)",
    },
    {
        "id": "fac-mgn-hosp-2",
        "name": "Chungthang Primary Health Centre (PHC)",
        "type": "hospital",
        "latitude": 27.6015,
        "longitude": 88.6440,
        "address": "Main Bazar, Chungthang",
        "district": "Mangan",
        "contact": "Demo contact (Duty Medical Officer)",
    },
    {
        "id": "fac-mgn-sch-1",
        "name": "Government Senior Secondary School, Mangan",
        "type": "school",
        "latitude": 27.5120,
        "longitude": 88.5300,
        "address": "Pentok, Mangan",
        "district": "Mangan",
        "contact": "Demo recipient (Headmaster)",
    },
    {
        "id": "fac-mgn-sch-2",
        "name": "Government Secondary School, Chungthang",
        "type": "school",
        "latitude": 27.6050,
        "longitude": 88.6490,
        "address": "Chungthang",
        "district": "Mangan",
        "contact": "Demo recipient (Office)",
    },
    # NAMCHI DISTRICT (SOUTH SIKKIM)
    {
        "id": "fac-nmc-auth-1",
        "name": "District Disaster Management Authority (DDMA) Namchi",
        "type": "authority",
        "latitude": 27.1667,
        "longitude": 88.3667,
        "address": "District Administration Centre, Namchi",
        "district": "Namchi",
        "contact": "03595-254444 / 1077 (Official DEOC)",
    },
    {
        "id": "fac-nmc-auth-2",
        "name": "Jorethang Sub-Divisional Emergency Response Cell",
        "type": "authority",
        "latitude": 27.1167,
        "longitude": 88.3167,
        "address": "Sub-Divisional Office, Jorethang",
        "district": "Namchi",
        "contact": "112 / 03595-257211 (Official Response Desk)",
    },
    {
        "id": "fac-nmc-hosp-1",
        "name": "Namchi District Hospital",
        "type": "hospital",
        "latitude": 27.1690,
        "longitude": 88.3620,
        "address": "Hospital Dara, Namchi",
        "district": "Namchi",
        "contact": "03595-254231 (Demo contact - Casualty)",
    },
    {
        "id": "fac-nmc-sch-1",
        "name": "Government Senior Secondary School, Namchi",
        "type": "school",
        "latitude": 27.1710,
        "longitude": 88.3650,
        "address": "Namchi",
        "district": "Namchi",
        "contact": "Demo recipient (Office)",
    },
    # GYALSHING DISTRICT (WEST SIKKIM)
    {
        "id": "fac-gyl-auth-1",
        "name": "District Disaster Management Authority (DDMA) Gyalshing",
        "type": "authority",
        "latitude": 27.2833,
        "longitude": 88.2500,
        "address": "District Administrative Complex, Kyongsa, Gyalshing",
        "district": "Gyalshing",
        "contact": "03595-250888 / 1077 (Official DEOC)",
    },
    {
        "id": "fac-gyl-hosp-1",
        "name": "Gyalshing District Hospital",
        "type": "hospital",
        "latitude": 27.2810,
        "longitude": 88.2480,
        "address": "Kyongsa, Gyalshing",
        "district": "Gyalshing",
        "contact": "03595-250722 (Demo contact - Emergency)",
    },
    {
        "id": "fac-gyl-sch-1",
        "name": "Government Senior Secondary School, Gyalshing",
        "type": "school",
        "latitude": 27.2850,
        "longitude": 88.2520,
        "address": "Kyongsa Ground, Gyalshing",
        "district": "Gyalshing",
        "contact": "Demo recipient (Principal)",
    },
    # PAKYONG DISTRICT
    {
        "id": "fac-pky-auth-1",
        "name": "District Disaster Management Authority (DDMA) Pakyong",
        "type": "authority",
        "latitude": 27.2333,
        "longitude": 88.5833,
        "address": "DAC Complex, Pakyong",
        "district": "Pakyong",
        "contact": "03592-257001 / 1077 (Official DEOC)",
    },
    {
        "id": "fac-pky-hosp-1",
        "name": "Pakyong Community Health Centre (CHC)",
        "type": "hospital",
        "latitude": 27.2350,
        "longitude": 88.5860,
        "address": "Main Bazar, Pakyong",
        "district": "Pakyong",
        "contact": "Demo contact (Emergency Desk)",
    },
    {
        "id": "fac-pky-sch-1",
        "name": "St. Xavier's School, Pakyong",
        "type": "school",
        "latitude": 27.2380,
        "longitude": 88.5810,
        "address": "Pakyong",
        "district": "Pakyong",
        "contact": "Demo recipient (Office)",
    },
    # SORENG DISTRICT
    {
        "id": "fac-srn-auth-1",
        "name": "District Disaster Management Authority (DDMA) Soreng",
        "type": "authority",
        "latitude": 27.1833,
        "longitude": 88.1833,
        "address": "DC Office Complex, Soreng",
        "district": "Soreng",
        "contact": "03595-253000 / 1077 (Official DEOC)",
    },
    {
        "id": "fac-srn-hosp-1",
        "name": "Soreng Community Health Centre (CHC)",
        "type": "hospital",
        "latitude": 27.1850,
        "longitude": 88.1850,
        "address": "Soreng Bazar",
        "district": "Soreng",
        "contact": "Demo contact (Emergency Desk)",
    },
    {
        "id": "fac-srn-sch-1",
        "name": "Government Senior Secondary School, Soreng",
        "type": "school",
        "latitude": 27.1810,
        "longitude": 88.1810,
        "address": "Soreng",
        "district": "Soreng",
        "contact": "Demo recipient (Principal)",
    },
]

TYPE_PRIORITY = {
    "authority": 1,
    "hospital": 2,
    "school": 3,
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes the great-circle distance between two points in km."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def get_nearby_facilities(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
) -> list[dict]:
    """
    Finds facilities within `radius_km` of coordinates, sorted by
    priority (Authorities -> Hospitals -> Schools) and proximity.
    """
    with_distance = []
    for f in FACILITIES:
        d = haversine_km(latitude, longitude, f["latitude"], f["longitude"])
        item = dict(f)
        item["distance_km"] = round(d, 2)
        with_distance.append(item)

    within_radius = [f for f in with_distance if f["distance_km"] <= radius_km]

    # Fallback to closest 5 if none within the immediate radius
    pool = within_radius if len(within_radius) > 0 else sorted(with_distance, key=lambda x: x["distance_km"])[:5]

    return sorted(
        pool,
        key=lambda x: (TYPE_PRIORITY.get(x["type"], 99), x["distance_km"]),
    )
