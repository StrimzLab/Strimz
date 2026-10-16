FROM ubuntu:24.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

COPY scripts/install-arc-foundry.sh /tmp/install-arc-foundry.sh
RUN /tmp/install-arc-foundry.sh /usr/local/bin && rm /tmp/install-arc-foundry.sh

EXPOSE 8545
ENTRYPOINT ["arc-anvil"]
CMD ["--network", "arc", "--host", "0.0.0.0", "--chain-id", "5042002", "--block-time", "2"]
