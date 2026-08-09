<?php

declare(strict_types=1);

namespace App\Repositories;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * The only repository for the shared storage_rows KV table.
 *
 * A row is identified by the composite key (store, uid).  Keep that pair in
 * every mutating method: uid is deliberately not globally unique because
 * stores may contain records with the same uid.
 */
final class StorageRowRepository
{
    public function query(): Builder
    {
        return DB::table('storage_rows');
    }

    public function forStore(string $store): Builder
    {
        return $this->query()->where('store', $store);
    }

    public function find(string $store, string $uid): ?stdClass
    {
        return $this->forStore($store)->where('uid', $uid)->first();
    }

    public function findByUidOrRecordId(string $uid, ?string $store = null): ?stdClass
    {
        return $this->query()
            ->when($store !== null, fn (Builder $query) => $query->where('store', $store))
            ->where(function (Builder $query) use ($uid): void {
                $query->where('uid', $uid)->orWhereRaw("data->>'id' = ?", [$uid]);
            })
            ->first();
    }

    /** @return Collection<int, stdClass> */
    public function findManyByUidOrRecordId(string $store, string $id): Collection
    {
        return $this->forStore($store)
            ->where(function (Builder $query) use ($id): void {
                $query->where('uid', $id)->orWhereRaw("data->>'id' = ?", [$id]);
            })
            ->get();
    }

    /**
     * @param  list<array{store: string, uid: string}>  $keys
     * @return Collection<string, stdClass> keyed as "store\0uid"
     */
    public function findManyByKeys(array $keys): Collection
    {
        if ($keys === []) {
            return collect();
        }

        return $this->query()
            ->where(function (Builder $query) use ($keys): void {
                foreach ($keys as $key) {
                    $query->orWhere(function (Builder $pair) use ($key): void {
                        $pair->where('store', $key['store'])->where('uid', $key['uid']);
                    });
                }
            })
            ->get()
            ->keyBy(fn (stdClass $row): string => $this->key($row->store, $row->uid));
    }

    /** @param array<string, mixed> $attributes */
    public function insert(string $store, string $uid, array $attributes): void
    {
        $this->query()->insert(['store' => $store, 'uid' => $uid] + $attributes);
    }

    /** @param array<string, mixed> $attributes */
    public function upsert(string $store, string $uid, array $attributes): void
    {
        $this->query()->updateOrInsert(['store' => $store, 'uid' => $uid], $attributes);
    }

    public function delete(string $store, string $uid): int
    {
        return $this->forStore($store)->where('uid', $uid)->delete();
    }

    public function key(string $store, string $uid): string
    {
        return $store."\0".$uid;
    }
}
