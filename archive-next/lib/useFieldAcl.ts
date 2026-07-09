import { useState, useEffect } from "react";

export type FieldAcl = {
  canView: boolean;
  canEdit: boolean;
  userRole: string;
};

export function useFieldAcl(
  typeId: string,
  fieldName: string,
  apiClient: any
): FieldAcl | null {
  const [acl, setAcl] = useState<FieldAcl | null>(null);

  useEffect(() => {
    async function checkAcl() {
      try {
        const response = await apiClient.post(
          `/types/${typeId}/check-field-acl`,
          { fieldName }
        );
        if (response.ok) {
          setAcl({
            canView: response.canView,
            canEdit: response.canEdit,
            userRole: response.userRole,
          });
        }
      } catch (error) {
        console.error("Error checking field ACL:", error);
      }
    }

    if (typeId && fieldName) {
      checkAcl();
    }
  }, [typeId, fieldName, apiClient]);

  return acl;
}

export function useTypeFieldAcls(
  typeId: string,
  apiClient: any
): Record<string, FieldAcl> | null {
  const [acls, setAcls] = useState<Record<string, FieldAcl> | null>(null);

  useEffect(() => {
    async function fetchType() {
      try {
        const response = await apiClient.get(`/types/${typeId}`);
        if (response.ok && response.type) {
          const type = response.type;
          const fieldAcls: Record<string, FieldAcl> = {};

          for (const field of type.fields || []) {
            try {
              const aclResponse = await apiClient.post(
                `/types/${typeId}/check-field-acl`,
                { fieldName: field.name }
              );
              if (aclResponse.ok) {
                fieldAcls[field.name] = {
                  canView: aclResponse.canView,
                  canEdit: aclResponse.canEdit,
                  userRole: aclResponse.userRole,
                };
              }
            } catch (err) {
              console.error(`Error checking ACL for field ${field.name}:`, err);
            }
          }

          setAcls(fieldAcls);
        }
      } catch (error) {
        console.error("Error fetching type:", error);
      }
    }

    if (typeId) {
      fetchType();
    }
  }, [typeId, apiClient]);

  return acls;
}
