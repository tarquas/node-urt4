const ClasyncEmitter = require('clasync/emitter');

class Com extends ClasyncEmitter {
	async data(cmd) {
		const [, cvarName, cvarValue] = cmd.match(/^com cvar (\S+) ([\S\s]*)$/) || [];

		if (cvarName) {
			this.emit('cvar', {name: cvarName.toLowerCase(), value: cvarValue});
			if (this.urt4.cvarEcho) this.urt4.log(`~cvar: ${cvarName} = ${cvarValue}`);
			return;
		}

		const [, outText] = cmd.match(/^com out ([\S\s]*)$/) || [];

		if (outText) {
			let o = {text: outText}, e = this.emit('out', o);
			e = e && e.then ? await e : e;
			if (!e && this.urt4.echo) process.stdout.write(o.text);
			return;
		}

		const [, inCmd] = cmd.match(/^com in ([\S\s]*)$/) || [];

		if (inCmd) {
			let o = {cmd: inCmd}, e = this.emit('in', o);
			e = e && e.then ? await e : e;
			if (!e) this.urt4.cmd(`com in ${o.cmd}`);
			return;
		}

		const [, fsRestartMaps] = cmd.match(/^com fs_restart maps \n([\S\s]*)$/) || [];

		if (fsRestartMaps) {
			this.emit('fs_restart', {maps: fsRestartMaps.split('\n')});
			return;
		}
	}
}

module.exports = Com;
