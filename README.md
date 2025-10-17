FROM ubuntu:22.04
‎
‎ENV DEBIAN_FRONTEND=noninteractive \
‎    PYTHONDONTWRITEBYTECODE=1 \
‎    PYTHONUNBUFFERED=1 \
‎    JUPYTER_DIR=/workspace \
‎    TZ=UTC
‎
‎# 1) OS deps + dev tools + sudo + git + curl + Node.js (via NodeSource)
‎RUN apt-get update \
‎ && apt-get install -y --no-install-recommends \
‎    python3 python3-pip python3-venv \
‎    git curl wget ca-certificates \
‎    nano vim unzip zip \
‎    build-essential gcc g++ make \
‎    openssh-client sudo tini tzdata locales \
‎ && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
‎ && apt-get install -y --no-install-recommends nodejs \
‎ && rm -rf /var/lib/apt/lists/*
‎
‎# 2) Locale (opsional)
‎RUN sed -i 's/^# *en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen && locale-gen
‎
‎# 3) JupyterLab 4 + Jupyter Server 2
‎RUN pip3 install --no-cache-dir \
‎    jupyterlab==4.* \
‎    jupyter-server==2.*
‎
‎# 4) User non-root + sudo tanpa password
‎RUN useradd -m -u 1000 -s /bin/bash app \
‎ && mkdir -p "${JUPYTER_DIR}" \
‎ && chown -R app:app "${JUPYTER_DIR}" \
‎ && usermod -aG sudo app \
‎ && echo "app ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/010-app-nopasswd \
‎ && chmod 440 /etc/sudoers.d/010-app-nopasswd
‎
‎# 5) Clone repo ke dalam /workspace (pakai token/SSH kalau privat; ini publik)
‎USER app
‎WORKDIR ${JUPYTER_DIR}
‎RUN git clone --depth=1 https://github.com/nadjibunss/test.git "${JUPYTER_DIR}/test" || true
‎
‎# 6) Port default untuk platform
‎EXPOSE 8080
‎
‎# 7) tini sebagai init
‎USER root
‎ENTRYPOINT ["/usr/bin/tini", "--"]
‎
‎# 8) Jalankan JupyterLab tanpa token/password di 0.0.0.0:8080
‎USER app
‎CMD ["jupyter", "lab", \
‎     "--ServerApp.ip=0.0.0.0", \
‎     "--ServerApp.port=8080", \
‎     "--ServerApp.root_dir=/workspace", \
‎     "--ServerApp.base_url=/", \
‎     "--IdentityProvider.token=", \
‎     "--ServerApp.password=", \
‎     "--ServerApp.open_browser=False", \
‎     "--ServerApp.port_retries=0"]
