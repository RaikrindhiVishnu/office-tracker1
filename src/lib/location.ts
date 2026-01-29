const OFFICE_LAT = 17.483525799549234;
const OFFICE_LNG = 78.38086184927101;
const ALLOWED_RADIUS_METERS = 100;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

// Haversine formula
export function isInsideOffice(
  lat: number,
  lng: number
) {
  const R = 6371000; // meters
  const dLat = toRad(lat - OFFICE_LAT);
  const dLng = toRad(lng - OFFICE_LNG);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(OFFICE_LAT)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= ALLOWED_RADIUS_METERS;
}
