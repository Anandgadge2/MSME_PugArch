import { useEffect, useMemo, useState } from 'react';
import { bidWizardApi } from '../api';
import { MAHARASHTRA_DISTRICTS } from '../utils/constants';

export const useMasterData = (district?: string) => {
  const [districtOptions, setDistrictOptions] = useState<string[]>(() => [...MAHARASHTRA_DISTRICTS]);
  const [talukaOptions, setTalukaOptions] = useState<string[]>([]);
  const [villageOptions, setVillageOptions] = useState<string[]>(['City / Ward', 'Village', 'Industrial Area', 'Other']);

  useEffect(() => {
    let cancelled = false;
    bidWizardApi.searchMasterData('districts')
      .then(rows => {
        if (!cancelled && rows.length) setDistrictOptions(rows.map(row => row.value));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!district) {
      setTalukaOptions([]);
      return;
    }
    let cancelled = false;
    bidWizardApi.searchMasterData('talukas', '', district)
      .then(rows => {
        if (!cancelled) setTalukaOptions(rows.map(row => row.value));
      })
      .catch(() => {
        if (!cancelled) setTalukaOptions(['Central', 'North', 'South', 'East', 'West', 'Other']);
      });
    return () => {
      cancelled = true;
    };
  }, [district]);

  useEffect(() => {
    let cancelled = false;
    bidWizardApi.searchMasterData('villages', '', district)
      .then(rows => {
        if (!cancelled && rows.length) setVillageOptions(rows.map(row => row.value));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [district]);

  const talukas = useMemo(() => talukaOptions, [talukaOptions]);

  return {
    districts: districtOptions,
    talukas,
    villages: villageOptions,
  };
};
