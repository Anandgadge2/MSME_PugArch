export type DistrictMaster = {
  id?: number;
  name: string;
  state: string;
};

export type TalukaMaster = {
  id?: number;
  name: string;
  districtId?: number;
};

export type VillageMaster = {
  id?: number;
  name: string;
  talukaId?: number;
};
