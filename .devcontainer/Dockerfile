FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Azure Functions Core Tools v4
RUN curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft-archive-keyring.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-archive-keyring.gpg] https://packages.microsoft.com/debian/$(lsb_release -rs)/prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list \
  && apt-get update \
  && apt-get install -y azure-functions-core-tools-4 \
  && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@9

# Verify installs
RUN func --version && pnpm --version && node --version
