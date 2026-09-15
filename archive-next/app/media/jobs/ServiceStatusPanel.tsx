"use client";

import { useEffect, useState } from "react";
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
  const [services, setServices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch("/api/v1/system/services");
        if (!response.ok) {
          throw new Error("Failed to fetch service status");
        }
        const data = await response.json();
        setServices(data.services || {});
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
    const interval = setInterval(fetchServices, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

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
          <div>Loading service status...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${styles.servicePanel}`}>
        <h3 className="text-md font-semibold">{copy.serviceStatusTitle}</h3>
        <div className={styles.servicesContainer}>
          <div className="text-sm text-error">Error: {error}</div>
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
