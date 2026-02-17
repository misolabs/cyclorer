// For heading direction
const MIN_SPEED = 1.0
const MAX_HISTORY = 5;

let headingHistory = [];
let stableHeading = null;
let lastPos = null

export const Heading = {

    computeBearing(lat1, lon1, lat2, lon2) {
        const toRad = (d) => d * Math.PI / 180;
        const toDeg = (r) => r * 180 / Math.PI;

        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const Δλ = toRad(lon2 - lon1);

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x =
            Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

        const deg = (toDeg(Math.atan2(y, x)) + 360) % 360;

        // Quantise to 6 opr 12 main directions for more stability
        const quantised = Math.floor(deg / 60) * 60 + 30

        return quantised
    },

    smoothHeadingMode(headings){
    const buckets = new Map()

    // Fill buckets
    for(const h of headings){
        if(buckets.has(h))
        buckets.set(h, buckets.get(h) + 1)
        else buckets.set(h, 1)
    }

    // Find bucket with most entries
    let maxCount = 0
    let heading = 0
    for( const [k, v] of buckets){
        if(v > maxCount){
        maxCount = v
        heading = k
        }
    }
    return heading
    },

    update(latitude, longitude, speed){
        // Heading
        if (lastPos && speed !== null && speed > MIN_SPEED) {
            const h = Heading.computeBearing(
                lastPos.latitude,
                lastPos.longitude,
                latitude,
                longitude
            );

            headingHistory.push(h);
            if (headingHistory.length > MAX_HISTORY) {
                headingHistory.shift();
            }
        }

        stableHeading = Heading.smoothHeadingMode(headingHistory);
        lastPos = { latitude, longitude };  
        
        return stableHeading
    }
}
