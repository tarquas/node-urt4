const config = require('./config');
const net = require('net');
const child = require('child_process');

const Clasync = require('clasync');
const DbHub = require('./db');
const Urt4 = require('./urt4');

const target = process.env.NODE_TARGET;

class App extends Clasync {
  static get type() { return 'app'; }

  async init(sub) {
    this.urt4s = {};
    this.nextUrt4Id = 0;

    await sub({
      $db: DbHub.sub(this.db)
    });

    this.createServer();
    process.stdin.on('data', this.sendCmd.bind(this));
  }

  switchToServer(id) {
    const urt4 = this.urt4s[id];
    if (!urt4) return console.log('No active URT4 server. Use ~help');
    this.curUrt4Id = id;
    console.log(`Input control at: ${urt4.getDesc()}`);
  }

  createServer() {
    if (this.server) throw new Error('Server already created');

    this.server = net.createServer(async(socket) => {
      const id = this.nextUrt4Id++;
      socket.setNoDelay(true);

      await this.$.delay(1000);

      this.$.subSet.call(this, {
        [id]: Urt4.sub({
          id,
          socket,
          cwd: `${__dirname}/../..`,
          $db: this.$db
        })
      });

      socket.on('close', async(hadError) => {
        await this.$.finish(await this[id], {hadError});
        delete this[id];
      });
    });

    this.server.on('listening', function() {
      const address = this.address();
      console.log('Urt4 Controller Server listening on ' + address.address + ":" + address.port);
      console.log('Type "~help" to view available commands');
    });

    this.server.listen(this.port, '127.0.0.1');
  }

  async sendCmd(rawcmd) {
    if (rawcmd[rawcmd.length-1] != 10) return;
    const cmd = rawcmd.toString();

    if (cmd === '~q\n') return this.$.exit(0);

    if (cmd === '~ls\n') {
      for (const urt4 of Object.values(this.urt4s)) {
        console.log(urt4.getDesc());
      }

      return;
    }

    if (cmd === '~\n') {
      for (const urt4 of Object.values(this.urt4s)) {
        urt4.act = false;
        urt4.echo = false;
        urt4.cvarEcho = false;
      }

      console.log('Everything made silent');
      return;
    }

    if (cmd === '\n') {
      this.switchToServer(this.curUrt4Id);
      return;
    }

    if (cmd === '~help\n') {
      console.log('=== NodeUrt4 console help ===');
      console.log('* Overall commands:');
      console.log('~ -- disable all regular output (previously enabled by "~echo on", "~cvar on", and "~act on" on any server).');
      console.log('~q -- quit from mod');
      console.log('~ls -- list Urt servers (PIDs, UDP ports, host names) controlled by this mod.');
      console.log('~<Number> -- switch to server #<Number>, f.x. "~1" -- switch to #1.');
      console.log('~run <port> [<config>] -- start Urt4 engine on port <port> and exec <config> (default: "server.cfg").');
      console.log('');
      console.log('* Commands in current server:');
      console.log('~act [<on|1|off|0>] -- log client/server commands.');
      console.log('~echo [<on|1|off|0>] -- log console output.');
      console.log('~cvar [<on|1|off|0>] -- log CVar changes.');
      console.log('~cvar <name> <value> -- force set CVar value.');
      console.log('~raw <com|sv|sys ...> -- send raw API command or RPC.');
      console.log('~<com|sv|sys ...> -- same as above.');
      console.log('<ENTER> -- press ENTER without any input to show current server under console input control.');
      console.log('<COMMAND> -- anything not starting with "~" is a command to Urt4 engine console (f.x. "quit" to shutdown server).');
    }

    const [, useId] = cmd.match(/^~(\d+)/) || [];
    if (useId) { this.switchToServer(useId); return; }

    const [, startPort, startCfg] = cmd.match(/^~run\s+(\d+)(?:\s+(\w+))?/) || [];
    if (startPort) return this.startUrt4((startPort | 0) || 27960, startCfg);

    const urt4 = this.urt4s[this.curUrt4Id];
    if (urt4) return await urt4.sendCmd(cmd);

    this.switchToServer(this.curUrt4Id);
  }

  startUrt4(port, cfg, dedicated) {
    const pr = child.spawn(
      `./${target === 'debug' ? 'lib-debug' : 'lib'}/urt4-api-server.run`,

      [
        this.port, '.',
        '+set', 'dedicated', dedicated || '2',
        '+set', 'net_port', port,
        '+set', 'net_port6', port,
        '+set', 'fs_basepath', '.',
        '+set', 'fs_libpath', '.',
        '+set', 'fs_homepath', '.',
        '+set', 'com_hunkmegs', '200',
        '+set', 'sv_hostname', '^3pwnz^5.pro^7',
        '+set', 'nodeurt_modes', 'bomb ctf ctf.fun ctf.uz ctf.old ffa ffa.unleash freeze ts ts.fun ts.uz',
        '+set', 'nodeurt_mode', 'ctf',
        '+exec', cfg || 'server'
      ],

      {cwd: `${__dirname}/../..`, detached: true, stdio: this.verb ? ['ignore', 'inherit', 'inherit'] : 'ignore'}
    );

    pr.on('close', (code) => {
      console.log(`Process ${pr.pid} has exited with code ${code}`);      
    });
  }

  static async configure() {
    return config;
  }

  async final(reason) {
    this.server.close();
    console.log('Urt4 Controller finished:', reason);
  }
}

////

module.exports = App;
