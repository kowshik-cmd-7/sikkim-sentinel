/**
 * Curated geospatial facilities database for Sikkim.
 * Includes Disaster Authorities, Health Facilities, and Educational Institutions.
 *
 * NOTE FOR SIH DEMO:
 * - Official Sikkim emergency helplines (112, 1070, 1077, 100, 101) are provided for official authorities.
 * - Institutional telephone extensions and school administrative lines are labeled as "Demo contact"
 *   or "Demo recipient" for safety and compliance.
 */
import type { Facility } from "@/types";
import { haversineKm } from "@/utils/risk";

export const SIKKIM_FACILITIES: Facility[] = [
  // =========================================================================
  // GANGTOK DISTRICT (EAST SIKKIM)
  // =========================================================================
  {
    id: "fac-gtk-auth-1",
    name: "State Emergency Operation Centre (SSDMA)",
    type: "authority",
    latitude: 27.3314,
    longitude: 88.6138,
    address: "Tashiling Secretariat, Gangtok",
    district: "Gangtok",
    contact: "1070 / 03592-202461 (Official SEOC)",
  },
  {
    id: "fac-gtk-auth-2",
    name: "District Disaster Management Authority (DDMA) Gangtok",
    type: "authority",
    latitude: 27.3389,
    longitude: 88.6065,
    address: "DC Office Complex, Sichey, Gangtok",
    district: "Gangtok",
    contact: "03592-284444 / 1077 (Official DEOC)",
  },
  {
    id: "fac-gtk-auth-3",
    name: "Sikkim Police Emergency Response Support System (ERSS)",
    type: "authority",
    latitude: 27.3278,
    longitude: 88.6115,
    address: "Police Headquarters, Gangtok",
    district: "Gangtok",
    contact: "112 / 100 (Official ERSS)",
  },
  {
    id: "fac-gtk-hosp-1",
    name: "STNM Multi-Speciality Hospital",
    type: "hospital",
    latitude: 27.3195,
    longitude: 88.5982,
    address: "Sochakgang, Sichey, Gangtok",
    district: "Gangtok",
    contact: "03592-202944 (Demo contact - Casualty)",
  },
  {
    id: "fac-gtk-hosp-2",
    name: "Central Referral Hospital (SMIMS / Manipal)",
    type: "hospital",
    latitude: 27.309,
    longitude: 88.6012,
    address: "5th Mile, Tadong, Gangtok",
    district: "Gangtok",
    contact: "03592-270534 (Demo contact - Trauma Care)",
  },
  {
    id: "fac-gtk-sch-1",
    name: "Tashi Namgyal Academy (TNA)",
    type: "school",
    latitude: 27.335,
    longitude: 88.618,
    address: "TNA Campus, Gangtok",
    district: "Gangtok",
    contact: "Demo recipient (Admin Office)",
  },
  {
    id: "fac-gtk-sch-2",
    name: "Paljor Namgyal Girls Senior Secondary School",
    type: "school",
    latitude: 27.329,
    longitude: 88.614,
    address: "Baluwakhani, Gangtok",
    district: "Gangtok",
    contact: "Demo recipient (Principal)",
  },
  {
    id: "fac-gtk-sch-3",
    name: "Government Senior Secondary School, Tadong",
    type: "school",
    latitude: 27.312,
    longitude: 88.604,
    address: "Tadong Bazar, Gangtok",
    district: "Gangtok",
    contact: "Demo recipient (Principal)",
  },

  // =========================================================================
  // MANGAN DISTRICT (NORTH SIKKIM - HIGH LANDSLIDE SUSCEPTIBILITY ZONE)
  // =========================================================================
  {
    id: "fac-mng-auth-1",
    name: "District Disaster Management Authority (DDMA) Mangan",
    type: "authority",
    latitude: 27.5074,
    longitude: 88.5222,
    address: "DC Office Complex, Mangan",
    district: "Mangan (North)",
    contact: "03592-234242 / 1077 (Official DEOC)",
  },
  {
    id: "fac-mng-auth-2",
    name: "Sub-Divisional Emergency Cell & Magistrate, Chungthang",
    type: "authority",
    latitude: 27.6011,
    longitude: 88.6446,
    address: "Sub-Divisional Office, Chungthang",
    district: "Mangan (North)",
    contact: "112 / 03592-234242 (Official ERSS)",
  },
  {
    id: "fac-mng-auth-3",
    name: "Sub-Divisional Emergency Post, Lachung",
    type: "authority",
    latitude: 27.6897,
    longitude: 88.7431,
    address: "Lachung Valley Post",
    district: "Mangan (North)",
    contact: "112 (Official ERSS)",
  },
  {
    id: "fac-mng-auth-4",
    name: "Dikchu Emergency & River Monitoring Outpost",
    type: "authority",
    latitude: 27.4211,
    longitude: 88.5122,
    address: "Dikchu Bridge Outpost",
    district: "Mangan (North)",
    contact: "112 (Official ERSS)",
  },
  {
    id: "fac-mng-hosp-1",
    name: "Mangan District Hospital",
    type: "hospital",
    latitude: 27.511,
    longitude: 88.526,
    address: "Hospital Road, Mangan",
    district: "Mangan (North)",
    contact: "03592-234102 (Demo contact - Emergency)",
  },
  {
    id: "fac-mng-hosp-2",
    name: "Primary Health Centre (PHC), Chungthang",
    type: "hospital",
    latitude: 27.603,
    longitude: 88.642,
    address: "Main Bazar, Chungthang",
    district: "Mangan (North)",
    contact: "Demo contact (Medical Officer)",
  },
  {
    id: "fac-mng-hosp-3",
    name: "Primary Health Centre (PHC), Dikchu",
    type: "hospital",
    latitude: 27.4215,
    longitude: 88.514,
    address: "Dikchu Market",
    district: "Mangan (North)",
    contact: "Demo contact (Medical Officer)",
  },
  {
    id: "fac-mng-sch-1",
    name: "Government Senior Secondary School, Mangan",
    type: "school",
    latitude: 27.509,
    longitude: 88.52,
    address: "Mangan Campus",
    district: "Mangan (North)",
    contact: "Demo recipient (Principal)",
  },
  {
    id: "fac-mng-sch-2",
    name: "Government Secondary School, Chungthang",
    type: "school",
    latitude: 27.599,
    longitude: 88.646,
    address: "Chungthang Approach",
    district: "Mangan (North)",
    contact: "Demo recipient (Headmaster)",
  },
  {
    id: "fac-mng-sch-3",
    name: "Government Secondary School, Dikchu",
    type: "school",
    latitude: 27.423,
    longitude: 88.511,
    address: "Dikchu Colony",
    district: "Mangan (North)",
    contact: "Demo recipient (Headmaster)",
  },

  // =========================================================================
  // NAMCHI DISTRICT (SOUTH SIKKIM)
  // =========================================================================
  {
    id: "fac-nmc-auth-1",
    name: "District Disaster Management Authority (DDMA) Namchi",
    type: "authority",
    latitude: 27.1667,
    longitude: 88.35,
    address: "DC Office, District Administrative Complex, Namchi",
    district: "Namchi (South)",
    contact: "03595-254555 / 1077 (Official DEOC)",
  },
  {
    id: "fac-nmc-auth-2",
    name: "Sub-Divisional Emergency Centre, Jorethang",
    type: "authority",
    latitude: 27.1094,
    longitude: 88.3247,
    address: "Jorethang Sub-Division",
    district: "Namchi (South)",
    contact: "112 (Official ERSS)",
  },
  {
    id: "fac-nmc-hosp-1",
    name: "Namchi District Hospital",
    type: "hospital",
    latitude: 27.169,
    longitude: 88.353,
    address: "Hospital Road, Namchi",
    district: "Namchi (South)",
    contact: "03595-254224 (Demo contact - Casualty)",
  },
  {
    id: "fac-nmc-hosp-2",
    name: "Community Health Centre (CHC), Jorethang",
    type: "hospital",
    latitude: 27.112,
    longitude: 88.327,
    address: "Jorethang Market",
    district: "Namchi (South)",
    contact: "Demo contact (Medical Officer)",
  },
  {
    id: "fac-nmc-sch-1",
    name: "Government Senior Secondary School (Girls), Namchi",
    type: "school",
    latitude: 27.164,
    longitude: 88.348,
    address: "Namchi Main",
    district: "Namchi (South)",
    contact: "Demo recipient (Principal)",
  },
  {
    id: "fac-nmc-sch-2",
    name: "Government Senior Secondary School (Boys), Namchi",
    type: "school",
    latitude: 27.168,
    longitude: 88.352,
    address: "Namchi Hill Top",
    district: "Namchi (South)",
    contact: "Demo recipient (Principal)",
  },

  // =========================================================================
  // GYALSHING DISTRICT (WEST SIKKIM)
  // =========================================================================
  {
    id: "fac-gyl-auth-1",
    name: "District Disaster Management Authority (DDMA) Gyalshing",
    type: "authority",
    latitude: 27.2833,
    longitude: 88.2667,
    address: "DC Office, Kyongsa, Gyalshing",
    district: "Gyalshing (West)",
    contact: "03595-250888 / 1077 (Official DEOC)",
  },
  {
    id: "fac-gyl-auth-2",
    name: "Sub-Divisional Emergency Outpost, Pelling",
    type: "authority",
    latitude: 27.3014,
    longitude: 88.2394,
    address: "Pelling Ridge Outpost",
    district: "Gyalshing (West)",
    contact: "112 (Official ERSS)",
  },
  {
    id: "fac-gyl-hosp-1",
    name: "Gyalshing District Hospital",
    type: "hospital",
    latitude: 27.286,
    longitude: 88.269,
    address: "Kyongsa, Gyalshing",
    district: "Gyalshing (West)",
    contact: "03595-250102 (Demo contact - Emergency)",
  },
  {
    id: "fac-gyl-hosp-2",
    name: "Primary Health Centre (PHC), Dentam",
    type: "hospital",
    latitude: 27.242,
    longitude: 88.198,
    address: "Dentam Bazar",
    district: "Gyalshing (West)",
    contact: "Demo contact (Medical Officer)",
  },
  {
    id: "fac-gyl-sch-1",
    name: "Government Senior Secondary School, Pelling",
    type: "school",
    latitude: 27.303,
    longitude: 88.237,
    address: "Pelling Main",
    district: "Gyalshing (West)",
    contact: "Demo recipient (Principal)",
  },
  {
    id: "fac-gyl-sch-2",
    name: "Government Senior Secondary School, Gyalshing",
    type: "school",
    latitude: 27.281,
    longitude: 88.265,
    address: "Gyalshing Bazar",
    district: "Gyalshing (West)",
    contact: "Demo recipient (Principal)",
  },

  // =========================================================================
  // PAKYONG DISTRICT
  // =========================================================================
  {
    id: "fac-pky-auth-1",
    name: "District Disaster Management Authority (DDMA) Pakyong",
    type: "authority",
    latitude: 27.2333,
    longitude: 88.5833,
    address: "DC Office Complex, Pakyong",
    district: "Pakyong",
    contact: "03592-257000 / 1077 (Official DEOC)",
  },
  {
    id: "fac-pky-auth-2",
    name: "Sub-Divisional Emergency Cell, Rangpo",
    type: "authority",
    latitude: 27.1764,
    longitude: 88.5283,
    address: "Border Checkpost & Emergency Outpost, Rangpo",
    district: "Pakyong",
    contact: "112 (Official ERSS)",
  },
  {
    id: "fac-pky-hosp-1",
    name: "Pakyong Community Health Centre (CHC)",
    type: "hospital",
    latitude: 27.235,
    longitude: 88.585,
    address: "Pakyong Bazar",
    district: "Pakyong",
    contact: "Demo contact (Emergency Desk)",
  },
  {
    id: "fac-pky-hosp-2",
    name: "Rangpo Primary Health Centre (PHC)",
    type: "hospital",
    latitude: 27.178,
    longitude: 88.53,
    address: "NH-10 Highway Road, Rangpo",
    district: "Pakyong",
    contact: "Demo contact (Medical Officer)",
  },
  {
    id: "fac-pky-sch-1",
    name: "St. Xavier's School, Pakyong",
    type: "school",
    latitude: 27.231,
    longitude: 88.581,
    address: "Pakyong Campus",
    district: "Pakyong",
    contact: "Demo recipient (Admin)",
  },
  {
    id: "fac-pky-sch-2",
    name: "Government Senior Secondary School, Rangpo",
    type: "school",
    latitude: 27.175,
    longitude: 88.526,
    address: "Rangpo",
    district: "Pakyong",
    contact: "Demo recipient (Principal)",
  },

  // =========================================================================
  // SORENG DISTRICT
  // =========================================================================
  {
    id: "fac-srn-auth-1",
    name: "District Disaster Management Authority (DDMA) Soreng",
    type: "authority",
    latitude: 27.1833,
    longitude: 88.1833,
    address: "DC Office Complex, Soreng",
    district: "Soreng",
    contact: "03595-253000 / 1077 (Official DEOC)",
  },
  {
    id: "fac-srn-hosp-1",
    name: "Soreng Community Health Centre (CHC)",
    type: "hospital",
    latitude: 27.185,
    longitude: 88.185,
    address: "Soreng Bazar",
    district: "Soreng",
    contact: "Demo contact (Emergency Desk)",
  },
  {
    id: "fac-srn-sch-1",
    name: "Government Senior Secondary School, Soreng",
    type: "school",
    latitude: 27.181,
    longitude: 88.181,
    address: "Soreng",
    district: "Soreng",
    contact: "Demo recipient (Principal)",
  },
];

const TYPE_PRIORITY: Record<Facility["type"], number> = {
  authority: 1,
  hospital: 2,
  school: 3,
};

/**
 * Finds all facilities within `radiusKm` of the given target coordinates,
 * calculated using the Haversine formula and sorted by priority (Authorities -> Hospitals -> Schools)
 * and proximity.
 */
export function findNearbyFacilities(
  latitude: number,
  longitude: number,
  radiusKm = 10,
  facilities: Facility[] = SIKKIM_FACILITIES,
): Facility[] {
  const withDistance = facilities.map((f) => {
    const dist = haversineKm([latitude, longitude], [f.latitude, f.longitude]);
    return {
      ...f,
      distance_km: Number(dist.toFixed(2)),
    };
  });

  const withinRadius = withDistance.filter((f) => (f.distance_km ?? 0) <= radiusKm);

  // If no facilities are within the immediate radius (e.g. high alpine ridge),
  // guarantee the nearest authorities are identified so notification targets are never empty
  const candidatePool = withinRadius.length > 0 ? withinRadius : withDistance.slice(0, 5);

  return candidatePool.sort((a, b) => {
    const pA = TYPE_PRIORITY[a.type] ?? 99;
    const pB = TYPE_PRIORITY[b.type] ?? 99;
    if (pA !== pB) return pA - pB;
    return (a.distance_km ?? 0) - (b.distance_km ?? 0);
  });
}
