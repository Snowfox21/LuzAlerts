export enum OutageSource {
    ANDE_OFFICIAL = 'ande_official',
    CROWDSOURCE = 'crowdsource',
    TWITTER = 'twitter',
}

export enum OutageStatus {
    ACTIVE = 'active',
    RESOLVED = 'resolved',
    PLANNED = 'planned',
}

export interface Outage {
    id: number;
    source: OutageSource;
    status: OutageStatus;
    title: string;
    description?: string;
    barrio?: string;
    feeder_number?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    created_at: string;
    resolved_at?: string;
    // PostGIS location usually comes as GeoJSON in many APIs, 
    // but let's assume we get lat/lon if needed for the map
    latitude?: number;
    longitude?: number;
}
