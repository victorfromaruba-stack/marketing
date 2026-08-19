#!/usr/bin/env bash
# Aruba Web Studio — OpenClaw on a fresh Hetzner box
#
#   ssh root@<new-server-ip>
#   curl -fsSL <this-file> -o deploy.sh && bash deploy.sh
#
# Run on a CLEAN server. Do NOT run this on the Minecraft box — a public game server
# is an open attack surface, and this machine will hold your Google credentials and be
# able to message your clients.
set -euo pipefail

USER_NAME="${USER_NAME:-studio}"
SSH_PUBKEY="${SSH_PUBKEY:-}"          # required: your ~/.ssh/id_ed25519.pub contents
SSH_PORT="${SSH_PORT:-22}"

[ -z "$SSH_PUBKEY" ] && { echo "Set SSH_PUBKEY first:  export SSH_PUBKEY=\"\$(cat ~/.ssh/id_ed25519.pub)\""; exit 1; }
[ "$(id -u)" -ne 0 ] && { echo "run as root"; exit 1; }

echo "==> base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades curl git jq ca-certificates \
  build-essential python3 python3-pip python3-venv

echo "==> user: $USER_NAME"
id -u "$USER_NAME" &>/dev/null || adduser --disabled-password --gecos "" "$USER_NAME"
usermod -aG sudo "$USER_NAME"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
echo "$SSH_PUBKEY" > "/home/$USER_NAME/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "/home/$USER_NAME/.ssh/authorized_keys"
chmod 600 "/home/$USER_NAME/.ssh/authorized_keys"

echo "==> ssh hardening"
cat > /etc/ssh/sshd_config.d/99-studio.conf <<SSHEOF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
AllowUsers $USER_NAME
SSHEOF
systemctl restart ssh || systemctl restart sshd

echo "==> firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp comment 'ssh'
# NOTE: 18789 (OpenClaw control plane) is deliberately NOT opened.
# Reach it over an SSH tunnel:  ssh -L 18789:localhost:18789 $USER_NAME@<ip>
ufw --force enable

echo "==> fail2ban"
cat > /etc/fail2ban/jail.local <<F2BEOF
[sshd]
enabled  = true
port     = $SSH_PORT
maxretry = 4
bantime  = 3600
findtime = 600
F2BEOF
systemctl enable --now fail2ban

echo "==> unattended security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<AUEOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
AUEOF

echo "==> node 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y -qq nodejs
node --version

echo "==> chromium deps for the QA gate"
apt-get install -y -qq \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2t64 fonts-liberation fonts-dejavu-core || true

echo "==> swap (4GB box + chromium + gateway runs tight)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null
  swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> openclaw (as $USER_NAME, never root)"
sudo -iu "$USER_NAME" bash <<'OCEOF'
set -e
curl -fsSL https://openclaw.ai/install.sh | bash
mkdir -p ~/studio ~/.openclaw
echo "openclaw installed for $(whoami)"
OCEOF

cat <<DONE

============================================================
  DONE — server hardened, OpenClaw installed.

  root login is now DISABLED. Reconnect as:
      ssh $USER_NAME@<ip>

  Port 18789 is firewalled off on purpose. To reach the
  control plane, tunnel it:
      ssh -L 18789:localhost:18789 $USER_NAME@<ip>
      then open http://localhost:18789

  Next:
   1. clone the studio repo into ~/studio
   2. cp openclaw/openclaw.json.example ~/.openclaw/openclaw.json
      and add your Anthropic API key
   3. copy openclaw/{SOUL,AGENTS,TOOLS,MEMORY,HEARTBEAT}.md into ~/studio
   4. cp openclaw/skills/* into your skills directory
   5. openclaw gateway
============================================================
DONE
