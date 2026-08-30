FROM ubuntu:24.04 AS build

ARG POSTGRES_SHA256=81a81ec695fb0c7901407defaa1d2f7973617154cf27ba74e3a7ab8e64436094
ARG PGVECTOR_SHA256=10bf9938906e5d643bbc4a7eea104b6f57ba4898e5b76b20e60484ea1d5a7f8f
ARG VALKEY_SHA256=7789fe1df257774457bafb4c1d56c9f7020c3879a7f5b4234af9030b2bd82dfd

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bison build-essential bzip2 ca-certificates curl flex libreadline-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /sources

RUN curl --fail --location --retry 3 --output postgresql-18.4.tar.bz2 https://ftp.postgresql.org/pub/source/v18.4/postgresql-18.4.tar.bz2 \
  && echo "${POSTGRES_SHA256}  postgresql-18.4.tar.bz2" | sha256sum --check \
  && curl --fail --location --retry 3 --output pgvector-v0.8.6.tar.gz https://github.com/pgvector/pgvector/archive/refs/tags/v0.8.6.tar.gz \
  && echo "${PGVECTOR_SHA256}  pgvector-v0.8.6.tar.gz" | sha256sum --check \
  && curl --fail --location --retry 3 --output valkey-9.1.0.tar.gz https://github.com/valkey-io/valkey/archive/refs/tags/9.1.0.tar.gz \
  && echo "${VALKEY_SHA256}  valkey-9.1.0.tar.gz" | sha256sum --check

RUN tar -xjf postgresql-18.4.tar.bz2 \
  && cd postgresql-18.4 \
  && ./configure --prefix=/opt/archive-postgres --without-icu --without-libxml --without-libxslt --without-ldap --without-readline --without-zlib \
  && make -j"$(nproc)" \
  && make install

RUN tar -xzf pgvector-v0.8.6.tar.gz \
  && cd pgvector-0.8.6 \
  && make -j"$(nproc)" PG_CONFIG=/opt/archive-postgres/bin/pg_config \
  && make PG_CONFIG=/opt/archive-postgres/bin/pg_config install

RUN tar -xzf valkey-9.1.0.tar.gz \
  && cd valkey-9.1.0 \
  && make -j"$(nproc)" MALLOC=libc BUILD_TLS=no

RUN mkdir -p /release/postgres /release/pgvector/lib /release/pgvector/share/extension /release/redis/bin /release/assets \
  && cp -a /opt/archive-postgres/. /release/postgres/ \
  && cp /opt/archive-postgres/lib/vector.so /release/pgvector/lib/vector.so \
  && cp /opt/archive-postgres/share/extension/vector* /release/pgvector/share/extension/ \
  && cp valkey-9.1.0/src/valkey-server /release/redis/bin/redis-server \
  && tar -C /release/postgres -czf /release/assets/archive-suite-native-linux-postgres-18.4.tar.gz . \
  && tar -C /release/pgvector -czf /release/assets/archive-suite-native-linux-pgvector-0.8.6.tar.gz . \
  && tar -C /release/redis -czf /release/assets/archive-suite-native-linux-redis-9.1.0.tar.gz . \
  && cd /release/assets \
  && sha256sum *.tar.gz > SHA256SUMS
