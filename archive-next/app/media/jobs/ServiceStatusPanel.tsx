"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { paths } from "@/lib/generated/archive-api";
import styles from "./jobs.module.css";

type ServiceState = "available" | "requires_setup" | "down";

interface Service {
  state: ServiceState;
  reason: string | null;
}

export function ServiceStatusPanel() {
  const { t } = useLocale();
  const copy = t.pages.mediaJobsPage;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [services, setServices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Through the API client, which carries the session. A raw fetch() sent
    // no credentials, so this panel answered 401 on every load and every
    // refresh: the service states it exists to show were never read.
    let active = true;
    const fetchServices = async () => {
      const response = await api.systemServices();
      if (!active) return;

      if (!response.ok) {
        setError(response.error || copy.serviceStatusFailed);
      } else {
        setServices(response.services || {});
        setError(null);
      }
      setLoading(false);
    };

    void fetchServices();
    const interval = setInterval(() => void fetchServices(), 30000); // Refresh every 30 seconds
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [api, copy.serviceStatusFailed]);

  const getBadgeColor = (state: ServiceState): string => {
    switch (state) {
      case "available":
        return "badge-success";
      case "requires_setup":
        return "badge-warning";
      case "down":
        return "badge-error";
      default:
        return "badge";
    }
  };

  const getStateLabel = (state: ServiceState): string => {
    switch (state) {
      case "available":
        return copy.serviceAvailable;
      case "requires_setup":
        return copy.serviceRequiresSetup;
      case "down":
        return copy.serviceDown;
      default:
        return state;
    }
  };

  const renderService = (name: string, service: Service) => {
    const serviceNameKey = name.toLowerCase() as keyof typeof copy;
    const serviceName =
      copy[serviceNameKey] || name.charAt(0).toUpperCase() + name.slice(1);

    return (
      <div key={name} className={styles.serviceRow}>
        <span className={styles.serviceName}>{serviceName}</span>
        <div className={styles.serviceStatus}>
          <span className={`badge ${getBadgeColor(service.state)}`}>
            {getStateLabel(service.state)}
          </span>
          {service.reason && (
            <span className={styles.serviceReason} title={service.reason}>
              {service.reason}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`card ${styles.servicePanel}`}>
        <h3 className="text-md font-semibold">{copy.serviceStatusTitle}</h3>
        <div className={styles.servicesContainer}>
          <div>{copy.serviceStatusLoading}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${styles.servicePanel}`}>
        <h3 className="text-md font-semibold">{copy.serviceStatusTitle}</h3>
        <div className={styles.servicesContainer}>
          <div className="text-sm text-error" role="alert">{error}</div>
        </div>
      </div>
    );
  }

  const storageServices = services.storage || {};
  const mainServices = [
    { name: "ffmpeg", service: services.ffmpeg },
    { name: "ffprobe", service: services.ffprobe },
    { name: "whisper", service: services.whisper },
    { name: "reverb", service: services.reverb },
    { name: "gpu", service: services.gpu },
  ];

  return (
    <div className={`card ${styles.servicePanel}`}>
      <h3 className="text-md font-semibold">{copy.serviceStatusTitle}</h3>
      <div className={styles.servicesContainer}>
        {mainServices.map(({ name, service }) =>
          service ? renderService(name, service) : null
        )}
        {Object.keys(storageServices).length > 0 && (
          <div className={styles.storageSection}>
            <span className={styles.storageName}>{copy.storage}</span>
            <div className={styles.storageServices}>
              {Object.entries(storageServices).map(([key, service]) =>
                renderService(key, service as Service)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
