import fs from 'node:fs';
const p = 'dist-standalone/skillspark-standalone.html';
const s = fs.readFileSync(p, 'utf8');
const ids = ['si-1', 'si-2', 'si-3', 'dup-1', 'dup-2', 'dup-3', 'ae-1', 'ae-2', 'ae-3', 'free-handbohrmaschine'];
for (const id of ids) {
  const us = id.replace(/-/g, '_');
  const start = s.indexOf('const meta_' + us);
  const endM = s.indexOf("INIT['" + id + "'] = init_" + us);
  if (start < 0 || endM < 0) { console.log('### ' + id + ' NICHT GEFUNDEN start=' + start + ' end=' + endM); continue; }
  const seg = s.slice(start, endM);
  console.log('### ' + id + ' len=' + seg.length);
  for (const line of seg.split('\n')) {
    if (/PCFSoft|envMapIntensity|hasEnvI|environmentIntensity|0x11141a|mapSize\.set|shadow\.bias|normalBias|shadow\.radius|const room|fromScene|PointLight\(0xffffff, 900|new PointLight|new HemisphereLight|new DirectionalLight|new AmbientLight|Math\.min\(2|setPixelRatio|const init_|is3d/.test(line)) {
      console.log('  |' + line.trim().slice(0, 220));
    }
  }
}
