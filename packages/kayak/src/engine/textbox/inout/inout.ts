import { CGMatrix } from '../cg'
import type { SvgSnapshotData, PathBBox, PathTransform } from '../types';


export function getMaxStrokeWeightPx(svgData: SvgSnapshotData): number {
	let max_offset_pt = 0;
	svgData.svg_path_info.forEach(path_info => {
		path_info.svg_paths.forEach(svg_path => {
			if (svg_path.stroke) {
				if (svg_path.stroke.align == 'center')
					max_offset_pt = Math.max(svg_path.stroke.weight / 2, max_offset_pt);
				else if (svg_path.stroke.align == 'outside')
					max_offset_pt = Math.max(svg_path.stroke.weight, max_offset_pt);
			}
		})
	})		

	let pt2px = 96 / 72;
	return max_offset_pt * pt2px;
}


/*	
	svg_path.d가 유의미한 값을 가지고 있지 않으면 null을 리턴한다.
*/
export function getBBoxFromSvgDPath(svg_path: { d: string; transform?: PathTransform[] }): PathBBox | null {
	if (svg_path.d.length === 0)
		return null;
	const commands = svg_path.d.match(/[a-zA-Z][^a-zA-Z]*/g)!;
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

	let currentX = 0, currentY = 0;

	let mat = new CGMatrix();
	let needTransform = svg_path.transform && svg_path.transform.length > 0
	if (needTransform) {
		for(let i=0; i<svg_path.transform!.length; i++) {
		// for(let i=svg_path.transform.length-1; i>=0; i--) {
			let t = svg_path.transform![i];
			if (t.translate) {
				mat.translate(t.translate.x, t.translate.y);
			}
			else if (t.rotate) {
				let radian = t.rotate.a / 180 * Math.PI;
				mat.rotateAtCenter(radian, {x: t.rotate.cx, y: t.rotate.cy});
			}
		}
	}

	function updateBoundingBox(x: number, y: number): void {
		let tr_pt: { x: number; y: number } = {x, y};

		if (needTransform) {
			tr_pt = mat.transformPoint({x, y});
		}

		minX = Math.min(minX, tr_pt.x);
		minY = Math.min(minY, tr_pt.y);
		maxX = Math.max(maxX, tr_pt.x);
		maxY = Math.max(maxY, tr_pt.y);
	}

	commands.forEach(command => {
		const type = command.charAt(0);
		let body = command.slice(1).trim();
		body = body.replace(/-/g, ' -'); // Add space before negative numbers (e.g. 0-1 => 0 -1)
		const args = body.split(/[\s,]+/).map(Number);

		switch (type) {
			case 'M':
			case 'L':
				for (let i = 0; i < args.length; i += 2) {
					const x = args[i];
					const y = args[i + 1];
					updateBoundingBox(x, y);
					currentX = x;
					currentY = y;
				}
				break;
			case 'H':
				args.forEach(x => {
					updateBoundingBox(x, currentY);
					currentX = x;
				});
				break;
			case 'V':
				args.forEach(y => {
					updateBoundingBox(currentX, y);
					currentY = y;
				});
				break;
			case 'Q':
				for (let i = 0; i < args.length; i += 4) {
					const x1 = args[i];
					const y1 = args[i + 1];
					const x = args[i + 2];
					const y = args[i + 3];
					updateBoundingBox(x1, y1);
					updateBoundingBox(x, y);
					currentX = x;
					currentY = y;
				}
				break;
			case 'T':
				for (let i = 0; i < args.length; i += 2) {
					const x = args[i];
					const y = args[i + 1];
					updateBoundingBox(x, y);
					currentX = x;
					currentY = y;
				}
				break;
			case 'C':
				for (let i = 0; i < args.length; i += 6) {
					const x1 = args[i];
					const y1 = args[i + 1];
					const x2 = args[i + 2];
					const y2 = args[i + 3];
					const x = args[i + 4];
					const y = args[i + 5];
					updateBoundingBox(x1, y1);
					updateBoundingBox(x2, y2);
					updateBoundingBox(x, y);
					currentX = x;
					currentY = y;
				}
				break;
			case 'S':
				for (let i = 0; i < args.length; i += 4) {
					const x2 = args[i];
					const y2 = args[i + 1];
					const x = args[i + 2];
					const y = args[i + 3];
					updateBoundingBox(x2, y2);
					updateBoundingBox(x, y);
					currentX = x;
					currentY = y;
				}
				break;
			case 'A':
				for (let i = 0; i < args.length; i += 7) {
					const x = args[i + 5];
					const y = args[i + 6];
					updateBoundingBox(x, y);
					currentX = x;
					currentY = y;
				}
				break;
			case 'Z':
				break; // No coordinates to update for Z
			default:
				console.warn('Unsupported command:', type);
		}
	});

	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}


