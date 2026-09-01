# Transcendence

## Getting started

### Requirements

- **Docker** and **Docker Compose**
- **GNU Make**
- **Node 24** — run `nvm use`, which reads `.nvmrc`

Node on your machine is not optional: `make up` builds the shared game-engine
package on the host before starting the containers.

### Setup

```sh
git clone git@github.com:ASprintNotAMarathon/Transcendence.git
cd Transcendence
cp .env.example .env
```

Then edit `.env` and set three values:

| Variable | How |
| --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `DATABASE_URL` | the same password, in the connection string |

The password may only contain `A-Za-z0-9._~-`. It is embedded in
`DATABASE_URL`, where `@ : / ? # %` are structural characters and would break
the URL.

`make up` refuses to start if any value is still a placeholder, or if
`DATABASE_URL` disagrees with the `POSTGRES_*` variables — so if you change the
password, change it in both places.

```sh
make up
```

The first run takes a few minutes: it installs dependencies and builds two
images. Afterwards it is seconds.

### Checking it worked

```sh
make ps
```

Three services, all `healthy`. Then:

| URL | Expected |
| --- | --- |
| http://localhost:5173 | the web app |
| http://localhost:3000/api/health | `{"status":"ok"}` |
| http://localhost:5173/api/health | the same, through the Vite proxy |

The third one is the useful check — it proves the web container can reach the
api container.

### Everyday commands

`make help` lists them all. The ones you need daily:

| Command | Does |
| --- | --- |
| `make up` | start everything, waits until healthy |
| `make down` | stop, **keep** the database |
| `make fclean` | stop and **delete** the database |
| `make logs` | follow all logs |
| `make psql` | a shell on the database |
| `make test` | run the game engine tests |

### Good to know

- Editing source hot-reloads inside the containers. No rebuild needed.
- Ports are published on `127.0.0.1` only, so nothing is exposed to the network.
- If a container will not start, `make logs` first.
