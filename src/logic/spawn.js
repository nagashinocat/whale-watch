// クジラが出る場所。崖の上から見て、クジラ全体が入るいちばん近いところだけに出る。
import { SPOT } from '../scene/cameras.js';
export { isVisibleFrom } from './view.js';

export function spawnPosition() {
  return [...SPOT];
}
