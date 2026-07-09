<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use stdClass;

class FieldAclService
{
    /**
     * Get field ACL rules for a type.
     *
     * @return array<string, array{view: string[], edit: string[]}>
     */
    public function getFieldAcl(string $typeId): array
    {
        $row = DB::table('storage_rows')
            ->where('store', 'types')
            ->where('uid', $typeId)
            ->first();

        if (!$row instanceof stdClass) {
            return [];
        }

        $data = json_decode($row->data, true);
        $acl = [];

        foreach ($data['fields'] ?? [] as $field) {
            $fieldAcl = $field['fieldAcl'] ?? null;
            $acl[$field['name']] = [
                'view' => $fieldAcl['view'] ?? [],
                'edit' => $fieldAcl['edit'] ?? [],
            ];
        }

        return $acl;
    }

    /**
     * Check if a user can view a field.
     */
    public function canViewField(string $typeId, string $fieldName, ?string $userRole): bool
    {
        if (!$userRole) {
            return false;
        }

        $fieldAcl = $this->getFieldAcl($typeId);
        if (!isset($fieldAcl[$fieldName])) {
            return true; // Field not found in type, assume accessible
        }

        $viewRoles = $fieldAcl[$fieldName]['view'];
        return empty($viewRoles) || in_array($userRole, $viewRoles);
    }

    /**
     * Check if a user can edit a field.
     */
    public function canEditField(string $typeId, string $fieldName, ?string $userRole): bool
    {
        if (!$userRole) {
            return false;
        }

        $fieldAcl = $this->getFieldAcl($typeId);
        if (!isset($fieldAcl[$fieldName])) {
            return true; // Field not found in type, assume editable
        }

        $editRoles = $fieldAcl[$fieldName]['edit'];
        return empty($editRoles) || in_array($userRole, $editRoles);
    }

    /**
     * Filter record data to only include fields the user can view.
     *
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    public function filterVisibleFields(string $typeId, array $record, ?string $userRole): array
    {
        $fieldAcl = $this->getFieldAcl($typeId);
        $filtered = [];

        foreach ($record as $fieldName => $value) {
            // Always include system fields (id, type, etc.)
            if (str_starts_with($fieldName, '_') || in_array($fieldName, ['id', 'uid', 'type', 'createdAt', 'updatedAt'])) {
                $filtered[$fieldName] = $value;
                continue;
            }

            if ($this->canViewField($typeId, $fieldName, $userRole)) {
                $filtered[$fieldName] = $value;
            }
        }

        return $filtered;
    }

    /**
     * Validate that a user can edit the provided fields.
     * Returns an array of field names the user cannot edit, or empty array if all OK.
     *
     * @param array<string, mixed> $fieldsToUpdate
     * @return array<int, string>
     */
    public function validateEditPermissions(string $typeId, array $fieldsToUpdate, ?string $userRole): array
    {
        $deniedFields = [];

        foreach (array_keys($fieldsToUpdate) as $fieldName) {
            // Skip system fields
            if (str_starts_with($fieldName, '_') || in_array($fieldName, ['id', 'uid', 'type', 'createdAt', 'updatedAt'])) {
                continue;
            }

            if (!$this->canEditField($typeId, $fieldName, $userRole)) {
                $deniedFields[] = $fieldName;
            }
        }

        return $deniedFields;
    }
}
