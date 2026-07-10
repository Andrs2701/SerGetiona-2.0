import { useState, useEffect } from 'react';
import { api, ENDPOINTS } from '@/lib/api';
import type { SystemStatus } from '@/lib/types';

export function useTaskStatuses(role?: string) {
  const [statuses, setStatuses] = useState<SystemStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const url = role 
      ? `${ENDPOINTS.TASK_STATUSES}?role=${role}` 
      : ENDPOINTS.TASK_STATUSES;

    api.get<SystemStatus[]>(url)
      .then((data) => {
        if (active) {
          setStatuses(data ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setStatuses([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [role]);

  return { statuses, loading };
}
