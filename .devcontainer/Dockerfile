FROM node:18.3.0

WORKDIR /ext

RUN apt -y update \
    && apt -y upgrade \
    && apt install -y curl git gcc \
    && curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain 1.47.0-x86_64-unknown-linux-gnu \
    && . $HOME/.cargo/env \
    && rustup component add rls rust-analysis rust-src rustfmt
