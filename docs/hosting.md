# Hosting, server ports, and DNS

[Back to README](../README.md) · English | [简体中文](hosting.zh-CN.md)

## Choose a hosting route

| Route | What works | Server ports you manage |
| --- | --- | --- |
| ChatGPT Sites | Full Worker backend, trusted login gateway, D1 storage, private access | None |
| VPS development preview | UI and browser-local plans; no real cloud login/sync or Outlook server APIs | SSH, optionally HTTP/HTTPS |
| Full production VPS deployment | Requires a new runtime adapter, database binding and authentication integration | Usually 80/443 after adaptation |

This repository currently supports the first two routes, not a ready-made production Node server. The following VPS commands are for a **temporary development preview**, not a production cloud deployment. No infrastructure changes are made merely by reading or cloning these instructions.

All examples use `planner.example.com`, `YOUR_SERVER_IP`, and an SSH user of `deploy`. Replace them with your own values. Do not copy another user’s Sites domain target or verification token.

## ChatGPT Sites: connect a custom domain

1. Deploy the site using the three steps in [README](../README.md#deploy-with-chatgpt-sites).
2. Register the complete hostname, such as `planner.example.com`, with that Site. Obtain its exact DNS target and verification record.
3. At your DNS provider, add the records returned by Sites:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `planner` (or the full hostname if your provider requires it) | The exact target hostname returned by Sites |
   | TXT | The exact verification name returned by Sites | The exact verification token returned by Sites |

4. Use the default TTL or 300 seconds. Where your DNS provider offers an HTTP proxy, start with DNS-only mode unless Sites explicitly supports that proxy setup. Request a domain status refresh in Sites after saving the records.
5. Wait until domain validation and TLS provisioning are active, then test `https://planner.example.com`.

A CNAME value is a hostname: no `https://`, URL path, or port. **Do not add A or AAAA records at the same name as a CNAME.** The CNAME target already resolves to the hosting provider’s addresses. Do not guess a Sites IPv4/IPv6 address. Place the verification TXT at the exact name Sites specifies; a CNAME cannot coexist with TXT at the same DNS owner name either. If the returned instructions seem to conflict, check them with Sites rather than relocating the TXT by guesswork.

For an apex domain such as `example.com`, follow the provider’s supported instructions for ALIAS/ANAME/CNAME flattening or explicit address records. Do not assume an ordinary apex CNAME works with your zone’s existing records. A subdomain is usually easier.

DNS points traffic at a host; it does not register the hostname with the hosting service or publish the application. A working DNS lookup followed by a platform 404 often means the hostname is not attached to the correct deployed site, or routing is still being provisioned.

## VPS: run a private preview through SSH

On the server, install Node.js 24+, npm and Git, then:

```bash
git clone https://github.com/Raining-Sunshine/Personal-Research-Planner.git
cd Personal-Research-Planner
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Keep this terminal open while previewing. Vite’s development middleware provides browser-local preview storage. It is not the production Worker.

On your own computer, open a second terminal:

```bash
ssh -N -L 5173:127.0.0.1:5173 deploy@YOUR_SERVER_IP
```

Now open `http://localhost:5173` on that computer. If its port 5173 is already used, change the **first** `5173` in the SSH command to `5174` and browse to port 5174. The server needs only its existing SSH access; do not expose port 5173 to the internet. This tunnel needs no DNS records.

## Optional: give the temporary VPS preview a domain

### 1. Add DNS records

For a VPS with a public address that you control:

| Type | Name | Value |
| --- | --- | --- |
| A | `planner` | Your VPS’s public IPv4 address |
| AAAA | `planner` | Your VPS’s public IPv6 address, only if IPv6 actually works end-to-end |

You can omit AAAA. A broken AAAA record can make the site fail on IPv6-capable clients even when IPv4 works. Remove an old CNAME at this same name before switching to A/AAAA. Changing a DNS record does not move any existing plan database.

DNS records contain addresses or hostnames, **not port numbers**. HTTP defaults to 80, HTTPS to 443. A port such as 5173 would have to appear in the URL; use a reverse proxy instead.

### 2. Open the public web ports

Allow inbound **TCP 80 and TCP 443** in the VPS provider’s security group/network firewall and in the server’s own firewall. Keep the SSH port available to your administration IP. If using IPv6, apply equivalent IPv6 rules. Port 5173 stays private on loopback.

For an Ubuntu/Debian server using UFW, review the existing rules first:

```bash
sudo ufw status verbose
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

`OpenSSH` usually means port 22. If your SSH service uses another port, allow that actual port before enabling the firewall. These commands add rules but do not enable an inactive firewall. Only after verifying SSH access and required existing services, enable it with `sudo ufw enable` if desired. Do not reset existing firewall rules. If you use nftables/firewalld instead, make equivalent changes there rather than stacking firewall managers.

### 3. Run the preview for the chosen hostname

Stop the earlier Vite process, then start it with an explicit allowed hostname:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=planner.example.com npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Do not set `allowedHosts: true` or bind this development process to a public interface. The terminal must stay running; closing it stops the preview. Do not install it as your permanent production service.

### 4. Put Caddy in front of it

Install [Caddy](https://caddyserver.com/docs/install) using its official instructions for your OS. Caddy can terminate TLS and obtain/renew a certificate automatically when DNS and inbound ports are correct.

Generate a password hash interactively; do not put a plaintext password in the command or repository:

```bash
caddy hash-password
```

Add this site block to `/etc/caddy/Caddyfile`, preserving any existing sites. Replace `REPLACE_WITH_HASH` with the generated hash, and replace the domain:

```caddyfile
planner.example.com {
    basic_auth {
        planner REPLACE_WITH_HASH
    }
    reverse_proxy 127.0.0.1:5173
}
```

This uses Caddy 2.8+ syntax. Basic authentication protects this temporary preview’s entry point; it does **not** add Planner user accounts or cloud storage. Keep access limited to trusted people. A browser visiting this hostname has separate localStorage from `localhost` and other browsers; export/import a preview backup if you need to move it.

Validate before reloading:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

These commands assume the package installed the standard systemd service and it is running. If it is not running, start it after validation with `sudo systemctl start caddy`. Caddy exposes the preview at `https://planner.example.com`; the Vite port is never public.

### 5. Diagnose connectivity

```bash
# DNS answers should match your chosen hosting route.
dig +short planner.example.com A
dig +short planner.example.com AAAA
dig +short planner.example.com CNAME

# On the VPS: confirm the process and proxy are listening.
sudo ss -ltnp
curl -I http://127.0.0.1:5173
sudo systemctl status caddy
sudo journalctl -u caddy -n 50 --no-pager

# From another device/network: verify the public HTTPS endpoint.
curl -I https://planner.example.com
```

With the password gate, an unauthenticated **401 is expected**; sign in in the browser to see the preview. Connection timeout suggests routing/firewall issues; 502 suggests Caddy cannot reach Vite; certificate errors suggest DNS/TLS provisioning issues. `dig` is available through `dnsutils` on Debian/Ubuntu. Review logs before sharing them; they may include private URLs or identifiers.

Stop the temporary Vite process and remove its Caddy block when finished. Remove only firewall/DNS entries specific to this preview if they are no longer needed; preserve other services.

## What full production self-hosting still needs

`dist/server/index.js` exports a Worker `fetch` handler; it does not listen on a TCP port. The current app also expects a D1-compatible `DB` binding and Sites’ trusted identity gateway. To deploy the full app elsewhere, implement and verify all of the following:

1. A runtime adapter for the Worker-style request/response interface, or a port to the target server framework.
2. Durable database storage, migration execution and equivalent prepared-statement/revision semantics.
3. Real authentication and per-user authorization. Strip untrusted identity headers at ingress and derive identity only from verified sessions. Implement equivalent login/logout routes used by the frontend.
4. Production HTTPS, correct origin/CSRF handling, secure runtime secret storage, and backups. If OAuth is used, configure its new HTTPS callback in both Microsoft and the environment.
5. A production service manager and health checks for the **adapted server**, with the application listening on loopback behind a reverse proxy.

The Caddy and DNS examples explain the network layer; they do not supply these missing application components. Keep using Sites for full cloud functionality until a production backend adaptation is implemented and tested.
