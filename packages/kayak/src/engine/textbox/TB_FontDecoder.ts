

export class FontDecoder {
	env: { prefix: number[]; infix: number[]; offset_to_infix: number; postfix: number[] };

	constructor() {
		this.env = {
			prefix : [72, 85, 33, 12, 42, 52, 12, 98, 23, 12, 0, 0, 0],
			infix : [32, 64, 34, 94, 22, 55, 24, 85, 12, 98, 83, 13, 19, 76],
			offset_to_infix : 256,
			postfix : [83, 13, 23, 55, 76, 34, 98, 25, 73, 32, 52, 71, 83, 23, 63, 54],
		}
	}

	decode_buffer(buf: ArrayBuffer): ArrayBuffer {
		let buf_is_encoded = this.test_validity_of_encoded_buf(buf);
		if (buf_is_encoded) {
			let decoded_buf = this.do_decode(buf)
			// console.log(decoded_buf)
			return decoded_buf;
		}
		else {
			// formal
			return buf;
		}
	}

	
	test_validity_of_encoded_buf(bytes: ArrayBuffer): boolean {
		// console.log(bytes)
		let buffer_1_view = new Uint8Array(bytes)
		// console.log(buffer_1_view)
		let offset = 0;
		let check_1 = this.compare_buf(this.env.prefix, buffer_1_view, offset, this.env.prefix.length);
		offset += this.env.prefix.length + this.env.offset_to_infix;
		let check_2 = this.compare_buf(this.env.infix, buffer_1_view, offset, this.env.infix.length);
		offset = buffer_1_view.length - this.env.postfix.length;
		let check_3 = this.compare_buf(this.env.postfix, buffer_1_view, offset, this.env.postfix.length);

		console.log(check_1, check_2, check_3)
		return check_1 && check_2 && check_3;
	}
	do_decode(bytes: ArrayBuffer): ArrayBuffer {
		let length = bytes.byteLength - (this.env.prefix.length + this.env.infix.length + this.env.postfix.length)
		let abuf = new ArrayBuffer(length)
		let view = new Uint8Array(abuf)

		let offset = this.env.prefix.length;
		view.set(new Uint8Array(bytes.slice(offset, offset+this.env.offset_to_infix)), 0)
		
		let abuf_offset = this.env.offset_to_infix;
		offset += this.env.offset_to_infix + this.env.infix.length;
		view.set(new Uint8Array(bytes.slice(offset, -this.env.postfix.length)), abuf_offset)

		return abuf;
	}

	compare_buf(target: ArrayLike<number>, src: ArrayLike<number>, offset: number, length: number): boolean {
		let matched = true;
		for(let i=0; i<length; i++) {
			if (target[i] != src[offset+i]) {
				matched = false;
				break;
			}
		}
		return matched;
	}
}