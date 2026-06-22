import { useEffect, useMemo, useState } from 'react';
import { bidWizardApi } from '../api';
import { MAHARASHTRA_DISTRICTS } from '../utils/constants';

export const useMasterData = (district?: string, state?: string) => {
  const [districtOptions, setDistrictOptions] = useState<string[]>(() => [...MAHARASHTRA_DISTRICTS]);
  const [talukaOptions, setTalukaOptions] = useState<string[]>([]);
  const [villageOptions, setVillageOptions] = useState<string[]>(['City / Ward', 'Village', 'Industrial Area', 'Other']);

  useEffect(() => {
    if (state && state !== 'Maharashtra') {
      setDistrictOptions([]);
      return;
    }
    let cancelled = false;
    bidWizardApi.searchMasterData('districts')
      .then(rows => {
        if (!cancelled && rows.length) setDistrictOptions(rows.map(row => row.value));
      })
      .catch(() => {
        if (!cancelled) setDistrictOptions([...MAHARASHTRA_DISTRICTS]);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    if (state && state !== 'Maharashtra') {
      setTalukaOptions([]);
      return;
    }
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
  }, [district, state]);

  useEffect(() => {
    if (state && state !== 'Maharashtra') {
      setVillageOptions(['City / Ward', 'Village', 'Industrial Area', 'Other']);
      return;
    }
    let cancelled = false;
    bidWizardApi.searchMasterData('villages', '', district)
      .then(rows => {
        if (!cancelled && rows.length) setVillageOptions(rows.map(row => row.value));
      })
      .catch(() => {
        if (!cancelled) setVillageOptions(['City / Ward', 'Village', 'Industrial Area', 'Other']);
      });
    return () => {
      cancelled = true;
    };
  }, [district, state]);

  const talukas = useMemo(() => talukaOptions, [talukaOptions]);

  return {
    districts: districtOptions,
    talukas,
    villages: villageOptions,
  };
};
