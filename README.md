# NodeUrt4

This is a [Game Modification](https://en.wikipedia.org/wiki/Mod_(video_gaming)) [boilerplate](https://en.wikipedia.org/wiki/Boilerplate_code) for [Node.js](https://nodejs.org/) of [Urban Terror (UrT) version 4](https://urbanterror.info/) game, based on [ioQuake3 (ioq3)](https://ioquake3.org/) [game engine](https://en.wikipedia.org/wiki/Game_engine).

We inject our hook declarations to functions of [Mickael9's](https://github.com/mickael9) [UrT engine code](https://github.com/mickael9/ioq3) via compiler extensions, and link modified UrT objects with our hook implementations and our TCP API implementation to an executable. It interacts via API with our Game Mod's [business-logic](https://en.wikipedia.org/wiki/Business_logic) code in Javascript.

# How to use?
## Dependencies
### Quick set we have success with
As of we, you also most likely to be lucky building and locally running this project if you get the following installed and available from your `PATH`:
* [Unix-like](https://en.wikipedia.org/wiki/Unix-like) OS.
* Latest stable [GNU Make](https://www.gnu.org/software/make/) tool (check `make -v` in terminal).
* Latest stable [GCC](https://gcc.gnu.org/) or [Clang](http://clang.llvm.org/) in `PATH` (check `cc -v`, `gcc -v`, and `clang -v` in terminal).
* Latest stable official [Node.js](https://nodejs.org/) with NPM bundled (check `node -v` and `npm -v` in terminal).
* Latest stable official [MongoDB](https://www.mongodb.com/) (Community Server is enough) running on `localhost` at default TCP port `27017` (check `netstat -ntlp | grep :27017` in terminal).
* GNU [Wget](https://www.gnu.org/software/wget/) for downloading of external files (check `wget -V` in terminal).
As you get this all, go to repo directory and type:
```
make run
```
This will automatically clone latest code of [Mickael9](https://github.com/mickael9)'s [repository](https://github.com/mickael9/ioq3) to `ioq3` directory and download minified UrT game directory `q3ut4` from [cloud](https://tarquas-urt.storage.googleapis.com/node-urt4/q3ut4-minified.zip) (128 MiB), extract the files, perform build, install NPM packages and locally run of UrT server.

## Example installation as a service on Debian 9
Below steps will set up 2 UrT servers: one for shooting modes (on default port) and one for jump mode (on port `1337`).
1) Prepare APT resources for [MongoDB](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-debian/):
```
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb http://repo.mongodb.org/apt/debian stretch/mongodb-org/4.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.listsudo apt-get update
```
2) Prepare APT resources for [Node.js](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions):
```
wget -qO- https://deb.nodesource.com/setup_8.x | sudo -E bash -
```
3) Install dependencies:
```
sudo apt-get install build-essential gcc git libcap2-bin make mongodb-org nodejs screen unzip
```
4) Add user `urt` and run `bash` from this user:
```
useradd -m urt
su urt -c bash
```
5) Clone this repo, compile the binary, and install NPM dependencies:
```
git clone --depth 1 git@github.com:tarquas/node-urt4.git ~/node-urt4
cd ~/node-urt4
make run-prepare
```
6) Install and run the services:
```
cp /home/urt/node-urt4/init.d/* /etc/init.d
systemctl enable urt-mod
systemctl enable urt-engine
systemctl enable urt-engine-jump
service urt-mod start
service urt-engine start
service urt-engine-jump start
```
Consoles of service processes are available via `screen`:
* for a mod: `screen -D -RR urt-mod`
* for UrT server: `screen -D -RR urt-engine`
* for UrT jump server: `screen -D -RR urt-mod`
7) Run the game and connect to your server. Go to mod console:
```
screen -D -RR urt-mod
```
Find your name in list of players and grant yourself administrator privileges (in example below your player is #2):
```
list
setlevel 2 admin
```
8) Press `CTRL+A,D` to detach from mod console screen.
9) In game console type `!help` (any of `.!@&/` may be used instead of `!`, but note that when using `/` some commands may be shadowed by client game engine f.x. `/map`).

## Details
* A C/C++ compiler and linker collection must be chosen to support `alias` and [`weak`](https://ofekshilon.com/2014/02/10/linker-weak-symbols/) [function attributes](https://gcc.gnu.org/onlinedocs/gcc-4.7.2/gcc/Function-Attributes.html) (this is used to organize our hooks). Latest [GCC](https://gcc.gnu.org/) or [Clang](http://clang.llvm.org/) must most likely be fine.
* We use [Node.js](https://nodejs.org/) as execution environment of our business logic written in Javascript. Latest stable version is recommended.
* We use [NPM](https://www.npmjs.com/) package manager to manage our Node.js' third-party modules we use in our Javascript code. Since it's bundled with Node.js, it's not needed to install it separately.

### Minification
Patched game engine (with hooks) supports the minified PK3 files (files which are not related to serverside engine are removed or truncated to zero). It allows to save resources on your server.

Compare the sizes of some bundled PK3 files to sizes of their original versions:

*Minified*
3.2M ut4_beijing_b3.pk3
4.4M ut4_facade_b5.pk3
1.7M ut4_orbital_sl.pk3
4.6M ut4_tohunga_b8.pk3
14M  total

*Original*
25M  ut4_beijing_b3.pk3
31M  ut4_facade_b5.pk3
15M  ut4_orbital_sl.pk3
18M  ut4_tohunga_b8.pk3
88M  total

## Extended map packs
We also provide 2 packs of maps, which may be quickly installed after all basic installation (after `make run` succeeded):
* fun pack for gun mode:
```
make installmaps-fun-1
```
* jump pack for jump mode:
```
make installmaps-jump-1
```

### Apply changes for newly installed maps
After you install new PK3 or alter list of maps in config, you can apply the changes by:
* *For PK3* either restart the engine or issue command `fs` as an admin (from game or server console);
* *For map config* restart the mod by issuing command `~q` from server console.

## Development notes
Mod and game engine are free to run alone without each other.
This allows you to make changes in mod code (in `/src/app`) and restart the mod without restarting the game engine.
However, modification of ioq3 hooks (in `/src/hooks` and `/include`) requires recompilation and restart of game engine.

The game engine alone will temporarily lose all mod features until the mod gets started again and catches API connection from engine.
Also, mod can handle multiple game engines (f.x. shooting and jump server in default setup).

# Copyleft
All dev bros are free to do with this stuff anything they want without any legal limitations if they keep this software free.
Also you're free to collaborate here, make proposals, features, bugfixes, pull requests etc. etc.

# Have fun!
