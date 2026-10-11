// apply(this, arguments)의 `as any`: strictBindCallApply가 IArguments/any[]를 튜플 매개변수에 대입하지 못한다. 메서드가 arguments로 인자 수를 분기하므로 런타임은 그대로.
declare const $: any;   // jQuery 전역(PR #24에서 제거됨). set()이 typeof 검사 뒤 instanceof에 쓴다. issues.md #9. 모듈 안의 ambient 선언이라 다른 파일에서는 $를 못 쓴다

class CGPoint {
    __typeinfo: string;
    x!: number;
    y!: number;

    constructor(x?: any, y?: number) {
        this.__typeinfo = 'CGPoint';
        this.set.apply(this, arguments as any);
    }

    set(src?: any, y?: number): this {
        if (arguments.length === 0) {
            this.x = 0; 
            this.y = 0;         
        }
        else if (arguments.length == 1) {
            if (src instanceof CGPoint) {
                this.x = src.x;
                this.y = src.y;           
            }
            else if (src instanceof CGSize) {
                this.x = 0;
                this.y = 0;           
            }
            else if (src instanceof CGRect) {
                this.x = src.origin.x;
                this.y = src.origin.y;
            }
            else if (typeof $ !== 'undefined' && src instanceof $) {   // jQuery가 없으면(PR #24 이후) 건너뛴다. issues.md #9
                this.x = parseFloat(src.css('left'));
                this.y = parseFloat(src.css('top'));           
            }
            else if (src.hasOwnProperty('x') && src.hasOwnProperty('y')) {
                this.x = src.x;
                this.y = src.y;
            }
        }
        else if (arguments.length == 2) {
            this.x = arguments[0];
            this.y = arguments[1];
        }
        return this;
    }

    add(delta?: any, y?: number): this {
        if (arguments.length == 1) {
            if (delta instanceof CGPoint) {
                this.x += delta.x;
                this.y += delta.y;
            }
            else if (delta instanceof CGSize) {
                this.x += delta.width;
                this.y += delta.height;
            }
        }
        else if (arguments.length == 2) {
            this.x += arguments[0];
            this.y += arguments[1];
        }
        return this;
    }

    subtract(delta?: any, y?: number): this {
        if (arguments.length == 1) {
            if (delta instanceof CGPoint) {
                this.x -= delta.x;
                this.y -= delta.y;
            }
            else if (delta instanceof CGSize) {
                this.x -= delta.width;
                this.y -= delta.height;
            }
        }
        else if (arguments.length == 2) {
            this.x -= arguments[0];
            this.y -= arguments[1];
        }
        return this;
    }

    multiply(sizeBy?: any, y?: number): this {
        if (arguments.length == 1) {
            if (sizeBy instanceof CGPoint) {
                this.x *= sizeBy.x;
                this.y *= sizeBy.y;
            }
            else if (sizeBy instanceof CGSize) {
                this.x *= sizeBy.width;
                this.y *= sizeBy.height; 
            }
        }
        else if (arguments.length == 2) {
            this.x *= arguments[0];
            this.y *= arguments[1];
        }
        return this;
    }

    divide(sizeBy?: any, y?: number): this {
        if (arguments.length == 1) {
            if (sizeBy instanceof CGPoint) {
                this.x /= sizeBy.x;
                this.y /= sizeBy.y;
            }
            else if (sizeBy instanceof CGSize) {
                this.x /= sizeBy.width;
                this.y /= sizeBy.height; 
            }
        }
        else if (arguments.length == 2) {
            this.x /= arguments[0];
            this.y /= arguments[1];
        }
        return this;
    }

    floor(): this {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    }

    ceil(): this {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    }

    round(): this {
        this.x = Math.floor(this.x+0.5);
        this.y = Math.floor(this.y+0.5);
        return this;
    }

    contained(container: CGSize | CGRect): boolean {
        if (container instanceof CGSize) {
            if (this.x >= 0 && this.y >= 0 && this.x <= container.width && this.y <= container.height) {
                return true;
            }
        }
        else if (container instanceof CGRect) {
            if (this.x >= container.origin.x && this.y >= container.origin.y && 
                this.x <= container.lastx() && this.y <= container.lasty()) {
                return true;
            }
        }
        return false;
    }
}

//////////////////////////////////////////////////////////////////////////

class CGSize {
    __typeinfo: string;
    width!: number;
    height!: number;

    constructor(width?: any, height?: number) {
        this.__typeinfo = 'CGSize';
        this.set.apply(this, arguments as any);
    }

    set(src?: any, height?: number): this {
        if (arguments.length === 0) {
            this.width = 0; 
            this.height = 0;         
        }
        else if (arguments.length == 1) {
            if (src instanceof CGPoint) {
                this.width = src.x;
                this.height = src.y;
            }
            else if (src instanceof CGSize) {
                this.width = src.width;
                this.height = src.height;
            }
            else if (src instanceof CGRect) {
                this.width = src.size.width;
                this.height = src.size.height;
            }        
            else if (typeof $ !== 'undefined' && src instanceof $) {   // jQuery가 없으면(PR #24 이후) 건너뛴다. issues.md #9
                this.width = parseFloat(src.css('width')); 
                this.height = parseFloat(src.css('height'));            
            }
            else if (src.hasOwnProperty('width') && src.hasOwnProperty('height')) {
                this.width = src.width;
                this.height = src.height;
            }  
            else {
                this.width = src;
                this.height = src;
            }      
        }
        else if (arguments.length == 2) {
            this.width = arguments[0];
            this.height = arguments[1];
        }
        return this;
    }

    add(delta?: any, h?: number): this {
        if (arguments.length == 1) {
            if (delta instanceof CGPoint) {
                this.width += delta.x;
                this.height += delta.y;
            }
            else if (delta instanceof CGSize) {
                this.width += delta.width;
                this.height += delta.height;
            }
        }
        else if (arguments.length == 2) {
            this.width += arguments[0];
            this.height += arguments[1];
        }
        return this;
    }

    subtract(delta?: any, h?: number): this {
        if (arguments.length == 1) {
            if (delta instanceof CGPoint) {
                this.width -= delta.x;
                this.height -= delta.y;
            }
            else if (delta instanceof CGSize) {
                this.width -= delta.width;
                this.height -= delta.height;
            }
        }
        else if (arguments.length == 2) {
            this.width -= arguments[0];
            this.height -= arguments[1];
        }
        return this;
    }

    multiply(sizeBy?: any, h?: number): this {
        if (arguments.length == 1) {
            if (sizeBy instanceof CGPoint) {
                this.width *= sizeBy.x;
                this.height *= sizeBy.y;
            }
            else if (sizeBy instanceof CGSize) {
                this.width *= sizeBy.width;
                this.height *= sizeBy.height; 
            }
        }
        else if (arguments.length == 2) {
            this.width *= arguments[0];
            this.height *= arguments[1];
        }
        return this;
    }

    divide(sizeBy?: any, h?: number): this {
        if (arguments.length == 1) {
            if (sizeBy instanceof CGPoint) {
                this.width /= sizeBy.x;
                this.height /= sizeBy.y;
            }
            else if (sizeBy instanceof CGSize) {
                this.width /= sizeBy.width;
                this.height /= sizeBy.height; 
            }
        }
        else if (arguments.length == 2) {
            this.width /= arguments[0];
            this.height /= arguments[1];
        }
        return this;
    }

    center(): CGPoint {
        return new CGPoint(this.width/2, this.height/2);
    }

    contains(containee: CGPoint | CGRect): boolean {
        if (containee instanceof CGPoint) {
            return containee.contained(this);
        }
        else if (containee instanceof CGRect) {
            if (containee.origin.contained(this) && containee.last().contained(this)) {
                return true;
            } 
        }
        return false;
    }

    floor(): this {
        this.width = Math.floor(this.width);
        this.height = Math.floor(this.height);
        return this;
    }

    ceil(): this {
        this.width = Math.ceil(this.width);
        this.height = Math.ceil(this.height);
        return this;
    }

    round(): this {
        this.width = Math.floor(this.width+0.5);
        this.height = Math.floor(this.height+0.5);
        return this;
    }

    swap(): this {
        var temp = this.width;
        this.width = this.height;
        this.height = temp;
        return this;
    }

    long(): number {
        return this.width > this.height ? this.width : this.height;
    }

    short(): number {
        return this.width < this.height ? this.width : this.height;
    }

    aspectRatio(): number {
        return this.width / this.height;
    }
}

///////////////////////////////////////////////////////////////////////////

class CGRect {
    __typeinfo: string;
    origin!: CGPoint;
    size!: CGSize;

    constructor(x?: any, y?: any, width?: number, height?: number) {
        this.__typeinfo = 'CGRect';
        this.set.apply(this, arguments as any);   
    }

    set(src?: any, a1?: any, a2?: number, a3?: number): this {
        if (arguments.length === 0) { 
            this.origin = new CGPoint();
            this.size = new CGSize();        
        }
        else if (arguments.length == 1) {
            if (src instanceof CGRect) {
                this.origin = new CGPoint(src.origin);
                this.size = new CGSize(src.size);
            }
            else if (src instanceof CGSize) {
                this.origin = new CGPoint(0, 0);
                this.size = new CGSize(src);            
            }
            else if (typeof $ !== 'undefined' && src instanceof $) {   // jQuery가 없으면(PR #24 이후) 건너뛴다. issues.md #9
                this.origin = new CGPoint(src);
                this.size = new CGSize(src);          
            }
            else if (src.hasOwnProperty('x') && src.hasOwnProperty('y') && 
                src.hasOwnProperty('width') && src.hasOwnProperty('height')) {
                this.origin = new CGPoint(src.x, src.y);
                this.size = new CGSize(src.width, src.height);
            }        
        }
        else if (arguments.length == 2) {
            this.origin = new CGPoint(arguments[0]);
            this.size = new CGSize(arguments[1]); 
        }
        else if (arguments.length == 4) {
            this.origin = new CGPoint(arguments[0], arguments[1]);
            this.size = new CGSize(arguments[2], arguments[3]); 
        }
        return this;
    }

    deflate(l: number, t?: number, r?: number, b?: number): this {
        if (arguments.length == 1) {
            this.origin.x += l;
            this.origin.y += l;
            this.size.width -= l+l;
            this.size.height -= l+l;
        }
        else {
            this.origin.x += l;
            this.origin.y += t!;
            this.size.width -= l+r!;
            this.size.height -= t!+b!;        
        }
        return this;
    }

    offset(offset?: any, y?: number): this {
        this.origin.add.apply(this.origin, arguments as any); 
        return this;
    }

    negativeOffset(offset?: any, y?: number): this {
        this.origin.subtract.apply(this.origin, arguments as any); 
        return this;
    }

    multiply(sizeBy?: any, y?: number): this {
        this.origin.multiply.apply(this.origin, arguments as any);
        this.size.multiply.apply(this.size, arguments as any);   
        return this;
    }

    divide(sizeBy?: any, y?: number): this {
        this.origin.divide.apply(this.origin, arguments as any);
        this.size.divide.apply(this.size, arguments as any); 
        return this;
    }

    center(): CGPoint {
        return new CGPoint(
            this.origin.x + this.size.width/2,
            this.origin.y + this.size.height/2
        );
    }

    centerx(): number {
        return this.origin.x + this.size.width/2;
    }

    centery(): number {
        return this.origin.y + this.size.height/2;
    }

    atCenter(center: { x: number; y: number }): this {
        this.origin.set(center.x-this.size.width/2, center.y-this.size.height/2);    
        return this;
    }

    last(): CGPoint {
        return new CGPoint(
            this.origin.x + this.size.width, 
            this.origin.y + this.size.height
        );
    }

    lastx(): number {
        return this.origin.x + this.size.width;
    }

    lasty(): number {
        return this.origin.y + this.size.height;
    }

    topLeft(): CGPoint {
        return new CGPoint(this.origin);
    }

    topRight(): CGPoint {
        return new CGPoint(
            this.origin.x + this.size.width, 
            this.origin.y
        );
    }

    bottomLeft(): CGPoint {
        return new CGPoint(
            this.origin.x, 
            this.origin.y + this.size.height
        );
    }

    bottomRight(): CGPoint {
        return this.last();
    }

    tl(): CGPoint {
        return this.topLeft();
    }

    tr(): CGPoint {
        return this.topRight();
    }

    bl(): CGPoint {
        return this.bottomLeft();
    }

    br(): CGPoint {
        return this.bottomRight();
    }

    point(index: number): CGPoint | undefined {
        if (index === 0) return this.tl();
        else if (index === 1) return this.tr();
        else if (index === 2) return this.bl();
        else if (index === 3) return this.br();            
    }

    contains(containee: CGPoint | CGSize | CGRect): boolean {
        if (containee instanceof CGPoint) {
            return containee.contained(this);
        }
        else if (containee instanceof CGSize) {
            if (0 >= this.origin.x && 0 >= this.origin.y &&
                containee.width <= this.lastx() && containee.height <= this.lasty()) {
                return true;
            } 
        }
        else if (containee instanceof CGRect) {
            if (containee.origin.x >= this.origin.x && containee.origin.y >= this.origin.y &&
                containee.lastx() <= this.lastx() && containee.lasty() <= this.lasty()) {
                return true;
            } 
        }
        return false;
    }

    touches(containee: CGPoint | CGSize | CGRect): boolean {
        if (containee instanceof CGPoint) {
            return containee.contained(this);
        }
        else if (containee instanceof CGSize) {
            if (0 >= this.origin.x && 0 >= this.origin.y &&
                containee.width <= this.lastx() && containee.height <= this.lasty()) {
                return true;
            } 
        }
        else if (containee instanceof CGRect) {
            if (containee.lastx() <= this.origin.x || containee.origin.x >= this.lastx() ||
                containee.lasty() <= this.origin.y || containee.origin.y >= this.lasty()) {
                return false;
            } 
            else {
                return true;
            }
        }
        return false;
    }

    bounds(containee: CGRect): void {
        if (containee instanceof CGRect) {
            if (containee.lastx() > this.lastx()) {
                containee.origin.x = this.lastx() - containee.size.width;
            }
            if (containee.origin.x < this.origin.x) {
                containee.origin.x = this.origin.x;
            }
            if (containee.lasty() > this.lasty()) {
                containee.origin.y = this.lasty() - containee.size.height;
            }
            if (containee.origin.y < this.origin.y) {
                containee.origin.y = this.origin.y;
            }
        }
    }

    crop(containee: CGRect): void {
        if (containee instanceof CGRect) {
            if (containee.lastx() > this.lastx()) {
                containee.size.width = this.lastx() - containee.origin.x;
            }
            if (containee.origin.x < this.origin.x) {
                containee.size.width = containee.lastx() - this.origin.x;
                containee.origin.x = this.origin.x;
            }
            if (containee.lasty() > this.lasty()) {
                containee.size.height = this.lasty() - containee.origin.y;            
            }
            if (containee.origin.y < this.origin.y) {
                containee.size.height = containee.lasty() - this.origin.y;            
                containee.origin.y = this.origin.y;
            }
        }
    }

    union(addition: CGRect): void {
        if (addition instanceof CGRect) {
            if (addition.origin.x < this.origin.x) {
                if (addition.lastx() > this.lastx()) {
                    this.size.width = addition.size.width;
                }
                else {
                    this.size.width = this.lastx() - addition.origin.x;
                }
                this.origin.x = addition.origin.x;            
            }
            else if (addition.lastx() > this.lastx()) {
                this.size.width = addition.lastx() - this.origin.x;
            }

            if (addition.origin.y < this.origin.y) {
                if (addition.lasty() > this.lasty()) {
                    this.size.height = addition.size.height;
                }
                else {
                    this.size.height = this.lasty() - addition.origin.y;
                }
                this.origin.y = addition.origin.y;            
            }
            else if (addition.lasty() > this.lasty()) {
                this.size.height = addition.lasty() - this.origin.y;
            }
        }
    }

    floorCeil(): this {
        this.origin.floor();
        this.size.ceil();
        return this;
    }

    ceilFloor(): this {
        this.origin.ceil();
        this.size.floor();
        return this;
    }
}

//////////////////////////////////////////////////////////////////////////////////

function CGPointMake(...args: any[]): CGPoint
{
    var pt = new CGPoint();
    pt.set.apply(pt, arguments as any);
    return pt;
}

function CGPointNegative(ptFrom: { x: number; y: number }): CGPoint
{
    return new CGPoint(-ptFrom.x, -ptFrom.y);
}

function CGPointAdd(ptFrom: any, ...rest: any[]): CGPoint
{
    var pt = new CGPoint(ptFrom);
    pt.add.apply(pt, Array.prototype.slice.call(arguments, 1) as any);
    return pt;
}

function CGPointSubtract(ptFrom: any, ...rest: any[]): CGPoint
{
    var pt = new CGPoint(ptFrom);
    pt.subtract.apply(pt, Array.prototype.slice.call(arguments, 1) as any);
    return pt;
}

function CGPointMultiply(ptFrom: any, ...rest: any[]): CGPoint
{
    var pt = new CGPoint(ptFrom);
    pt.multiply.apply(pt, Array.prototype.slice.call(arguments, 1) as any);
    return pt;
}

function CGPointDivide(ptFrom: any, ...rest: any[]): CGPoint
{
    var pt = new CGPoint(ptFrom);
    pt.divide.apply(pt, Array.prototype.slice.call(arguments, 1) as any);
    return pt;
}

function CGPointMap(ptFrom: any, boundSize: CGSize, map: CGRect | CGSize): CGPoint
{
    var mapSize = (map instanceof CGRect) ? map.size : map;
    var mapOrigin = (map instanceof CGRect) ? map.origin : undefined; 

    var ratio = CGSizeDivide(mapSize, boundSize);
    var pt = CGPointMultiply(ptFrom, ratio);
    if (mapOrigin) {
        pt.add(mapOrigin);
    }
    return pt;
}

/////////////////////////////////////////////////////////////////////////////////

function CGSizeMake(...args: any[]): CGSize
{
    var size = new CGSize();
    size.set.apply(size, arguments as any);
    return size;
}

function CGSizeSwap(size: CGSize): CGSize
{
    return new CGSize(size.height, size.width);
}

function CGSizeAdd(szFrom: any, ...rest: any[]): CGSize
{
    var size = new CGSize(szFrom);
    size.add.apply(size, Array.prototype.slice.call(arguments, 1) as any);
    return size;
}

function CGSizeSubtract(szFrom: any, ...rest: any[]): CGSize
{
    var size = new CGSize(szFrom);
    size.subtract.apply(size, Array.prototype.slice.call(arguments, 1) as any);
    return size;
}

function CGSizeMultiply(szFrom: any, ...rest: any[]): CGSize
{
    var size = new CGSize(szFrom);
    size.multiply.apply(size, Array.prototype.slice.call(arguments, 1) as any);
    return size;
}

function CGSizeDivide(szFrom: any, ...rest: any[]): CGSize
{
    var size = new CGSize(szFrom);
    size.divide.apply(size, Array.prototype.slice.call(arguments, 1) as any);
    return size;
}

function CGSizeFit(size: CGSize, bound: any): CGSize
{
//    var boundSize = (bound instanceof CGRect) ? bound.size : bound; 
    var boundSize = new CGSize(bound);
    var fitSize: CGSize;

    var ratio = CGSizeDivide(boundSize, size);
    if (ratio.width < ratio.height) {
        fitSize = CGSizeMake(boundSize.width, size.height * ratio.width);
    }
    else {
        fitSize = CGSizeMake(size.width * ratio.height, boundSize.height);
    }
    return fitSize;
}

function CGSizeFill(size: CGSize, bound: any): CGSize
{
//    var boundSize = (bound instanceof CGRect) ? bound.size : bound; 
    var boundSize = new CGSize(bound);
    var fitSize: CGSize;

    var ratio = CGSizeDivide(boundSize, size);
    if (ratio.width > ratio.height) {
        fitSize = CGSizeMake(boundSize.width, size.height * ratio.width);
    }
    else {
        fitSize = CGSizeMake(size.width * ratio.height, boundSize.height);
    }
    return fitSize;
}

//////////////////////////////////////////////////////////////////////////////////

function CGRectMake(...args: any[]): CGRect
{
    var rc = new CGRect();
    rc.set.apply(rc, arguments as any);
    return rc;
}

function CGRectAlignLeft(rect: CGRect, left: number): CGRect {
    return CGRectMake(left, rect.origin.y, rect.size.width, rect.size.height);
}

function CGRectAlignCenter(rect: CGRect, cx: number): CGRect {
    return CGRectMake(cx-rect.size.width/2, rect.origin.y, rect.size.width, rect.size.height);
}

function CGRectAlignRight(rect: CGRect, right: number): CGRect {
    return CGRectMake(right-rect.size.width, rect.origin.y, rect.size.width, rect.size.height);
}

function CGRectAlignTop(rect: CGRect, top: number): CGRect {
    return CGRectMake(rect.origin.x, top, rect.size.width, rect.size.height);
}

function CGRectAlignMiddle(rect: CGRect, cy: number): CGRect {
    return CGRectMake(rect.origin.x, cy-rect.size.height/2, rect.size.width, rect.size.height);
}

function CGRectAlignBottom(rect: CGRect, bottom: number): CGRect {
    return CGRectMake(rect.origin.x, bottom-rect.size.height, rect.size.width, rect.size.height);
}

function CGRectDeflate(rect: CGRect, l: number, t?: number, r?: number, b?: number): CGRect
{
    var rc = new CGRect(rect);
    if (arguments.length === 2) {
        rc.origin.x += l;
        rc.origin.y += l;
        rc.size.width -= l+l;
        rc.size.height -= l+l;
    }
    else {
        rc.origin.x += l;
        rc.origin.y += t!;
        rc.size.width -= l+r!;
        rc.size.height -= t!+b!;
    }
    return rc;
}

function CGRectMap(rectFrom: CGRect, bound: CGRect | CGSize, map: CGRect | CGSize): CGRect
{
    var mapSize = (map instanceof CGRect) ? map.size : map;
    var mapOrigin = (map instanceof CGRect) ? map.origin : undefined; 

    var srcSize = (bound instanceof CGRect) ? bound.size : bound;
    var srcOrigin = (bound instanceof CGRect) ? bound.origin : undefined; 

    var ratio = CGSizeDivide(mapSize, srcSize);
    var rect = CGRectMultiply(srcOrigin ? CGRectNegativeOffset(rectFrom, srcOrigin) : rectFrom, ratio);

    if (mapOrigin) {
        rect.offset(mapOrigin);
    }
    return rect;
}

function CGRectOffset(rectFrom: CGRect, ...rest: any[]): CGRect
{
    var rect = new CGRect(rectFrom);
    rect.offset.apply(rect, Array.prototype.slice.call(arguments, 1) as any);
    return rect;  
}

function CGRectNegativeOffset(rectFrom: CGRect, ...rest: any[]): CGRect
{
    var rect = new CGRect(rectFrom);
    rect.negativeOffset.apply(rect, Array.prototype.slice.call(arguments, 1) as any);
    return rect;  
}

function CGRectMultiply(rectFrom: CGRect, ...rest: any[]): CGRect
{
    var rect = new CGRect(rectFrom);
    rect.multiply.apply(rect, Array.prototype.slice.call(arguments, 1) as any);
    return rect;
}

function CGRectDivide(rectFrom: CGRect, ...rest: any[]): CGRect
{
    var rect = new CGRect(rectFrom);
    rect.divide.apply(rect, Array.prototype.slice.call(arguments, 1) as any);
    return rect;  
}

function CGRectCenter(rect: CGRect): CGPoint
{
    return new CGPoint(rect.center());
}

function CGRectAtCenter(src: CGSize | CGRect, anchor: CGPoint | CGSize | CGRect): CGRect
{
    var size!: CGSize, center!: CGPoint;
    if (src instanceof CGSize) {
        size = src;
    }
    else if (src instanceof CGRect) {
        size = src.size;
    }

    if (anchor instanceof CGPoint) {
        center = anchor;
    }
    else  if (anchor instanceof CGSize) {
        center = anchor.center();
    }
    else if (anchor instanceof CGRect) {
        center = anchor.center();
    }    
    return new CGRect(center.x-size.width/2, center.y-size.height/2, size.width, size.height);
}

function CGRectFill(size: CGSize, bound: any): CGRect
{
    var boundSize = (bound instanceof CGRect) ? bound.size : bound;
    var boundOrigin = (bound instanceof CGRect) ? bound.origin : undefined; 

    var rect = CGRectMake(size);
    var ratio = CGSizeDivide(boundSize, size);
    var fitSize: number;

    if (ratio.width > ratio.height) {
        fitSize = size.height * ratio.width;
        rect.origin.set(0, (boundSize.height - fitSize)/2);
        rect.size.set(boundSize.width, fitSize);
    }
    else {
        fitSize = size.width * ratio.height;
        rect.origin.set((boundSize.width - fitSize)/2, 0);
        rect.size.set(fitSize, boundSize.height);
    }

    if (boundOrigin) {
        rect.offset(bound.origin);        
    }
    return rect;
}

function CGRectFillWithRatio(size: CGSize, bound: any, pratio: number): CGRect
{
    var boundSize = (bound instanceof CGRect) ? bound.size : bound;
    var boundOrigin = (bound instanceof CGRect) ? bound.origin : undefined; 

    var rect = CGRectMake(size);
    var ratio = CGSizeDivide(boundSize, size);
    var fitSize: number;

    if (ratio.width > ratio.height) {
        fitSize = size.height * ratio.width;
        rect.origin.set(0, (boundSize.height - fitSize) * (1-pratio));
        rect.size.set(boundSize.width, fitSize);
    }
    else {
        fitSize = size.width * ratio.height;
        rect.origin.set((boundSize.width - fitSize) * (1-pratio), 0);
        rect.size.set(fitSize, boundSize.height);
    }

    if (boundOrigin) {
        rect.offset(bound.origin);        
    }
    return rect;   
}

function CGRectFit(size: CGSize, bound: any): CGRect
{
    var boundSize = (bound instanceof CGRect) ? bound.size : bound;
    var boundOrigin = (bound instanceof CGRect) ? bound.origin : undefined; 

    var rect = CGRectMake(size);
    var ratio = CGSizeDivide(boundSize, size);
    var fitSize: number;

    if (ratio.width < ratio.height) {
        fitSize = rect.size.height * ratio.width;
        rect.origin.set(0, (boundSize.height - fitSize)/2);
        rect.size.set(boundSize.width, fitSize);
    }
    else {
        fitSize = rect.size.width * ratio.height;
        rect.origin.set((boundSize.width - fitSize)/2, 0);
        rect.size.set(fitSize, boundSize.height);
    }

    if (boundOrigin) {
        rect.offset(bound.origin);        
    }
    return rect;
}

function CGRectOutFit(size: CGSize, bound: any): CGRect
{
    var boundSize = (bound instanceof CGRect) ? bound.size : bound;
    var boundOrigin = (bound instanceof CGRect) ? bound.origin : undefined; 

    var rect = CGRectMake(size);
    var ratio = CGSizeDivide(boundSize, size);
    var fitSize: number;

    if (ratio.width > ratio.height) {
        fitSize = rect.size.height * ratio.width;
        rect.origin.set(0, (boundSize.height - fitSize)/2);
        rect.size.set(boundSize.width, fitSize);
    }
    else {
        fitSize = rect.size.width * ratio.height;
        rect.origin.set((boundSize.width - fitSize)/2, 0);
        rect.size.set(fitSize, boundSize.height);
    }

    if (boundOrigin) {
        rect.offset(bound.origin);        
    }
    return rect;
}

function CGRectUpperBounds(rect: CGRect, bounds: CGRect): CGRect
{
    var newRect = CGRectMake(rect);

    if (newRect.size.width < bounds.size.width || newRect.size.height < bounds.size.height) {
        var outBounds = CGRectOutFit(newRect.size, bounds);
        newRect.size.width = outBounds.size.width;
        newRect.size.height = outBounds.size.height;
    }

    if (newRect.origin.x > bounds.origin.x) {
        newRect.origin.x = bounds.origin.x;
    }
    if (newRect.origin.y > bounds.origin.y) {
        newRect.origin.y = bounds.origin.y;
    }    
    if (newRect.lastx() < bounds.lastx()) {
        newRect.origin.x = bounds.lastx() - newRect.size.width;
    }    
    if (newRect.lasty() < bounds.lasty()) {
        newRect.origin.y = bounds.lasty() - newRect.size.height;
    }  
    return newRect;
}

function CGRectFlip(rect: CGRect, anchor: CGPoint | CGSize | CGRect, HorV: boolean): CGRect
{
    var center!: CGPoint;
    if (anchor instanceof CGPoint) {
        center = anchor;
    }
    else  if (anchor instanceof CGSize) {
        center = anchor.center();
    }
    else if (anchor instanceof CGRect) {
        center = anchor.center();
    }

    var newRect = CGRectMake(rect);
    if (HorV) {
        newRect.origin.x = center.x - (rect.lastx() - center.x);
    }
    return newRect;
}

function CGRectCrop(rectFrom: CGRect, bounds: CGRect): CGRect
{
    var rect = new CGRect(rectFrom);
    bounds.crop(rect);
    return rect;
}

function CGRectByPoints(pt0: { x: number; y: number }, pt1: { x: number; y: number }): CGRect
{
    var x0 = Math.min(pt0.x, pt1.x);
    var x1 = Math.max(pt0.x, pt1.x);
    var y0 = Math.min(pt0.y, pt1.y);
    var y1 = Math.max(pt0.y, pt1.y);    
    return CGRectMake(x0, y0, x1-x0, y1-y0);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////

function CGLog(prefix: string, src: any): void
{
    if (src instanceof CGPoint) {
        console.log(prefix, src.x, src.y);
    }
    else if (src instanceof CGSize) {
        console.log(prefix, src.width, src.height);
    }
    else if (src instanceof CGRect) {
        console.log(prefix, src.origin.x, src.origin.y, src.size.width, src.size.height);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////

class CGMatrix {
    a!: number;
    b!: number;
    c!: number;
    d!: number;
    tx!: number;
    ty!: number;

    constructor(a?: any, b?: number, c?: number, d?: number, tx?: number, ty?: number) {
        this.set.apply(this, arguments as any);   
    }

    set(a?: any, b?: number, c?: number, d?: number, tx?: number, ty?: number): this {
        if (arguments.length === 0) {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.tx = 0;
            this.ty = 0;
        }
        else if (arguments.length === 1) {
            this.a = arguments[0].a;
            this.b = arguments[0].b;
            this.c = arguments[0].c;
            this.d = arguments[0].d;
            this.tx = arguments[0].tx;
            this.ty = arguments[0].ty;                                        
        }
        else {
            this.a = a;
            this.b = b!;
            this.c = c!;
            this.d = d!;
            this.tx = tx || 0;
            this.ty = ty || 0;        
        }    
        return this;    
    }

    concat(matrix: CGMatrix): this {
        this.set(
          this.a * matrix.a + this.c * matrix.b,
          this.b * matrix.a + this.d * matrix.b,
          this.a * matrix.c + this.c * matrix.d,
          this.b * matrix.c + this.d * matrix.d,
          this.a * matrix.tx + this.c * matrix.ty + this.tx,
          this.b * matrix.tx + this.d * matrix.ty + this.ty
        );
        return this;
    }

    setRotation(theta: number): this {
        this.set(Math.cos(theta), Math.sin(theta), -Math.sin(theta), Math.cos(theta));       
        return this; 
    }

    rotate(theta: number): this {
        var mat = CGMatrixMake();
        this.concat(mat.setRotation(theta));
        return this;
    }

    rotateAtCenter(theta: number, ct: { x: number; y: number }): void {
        this.translate(ct.x, ct.y);
        this.rotate(theta);
        this.translate(-ct.x, -ct.y);
    }

    setScale(sx: number, sy: number): this {
        this.set(sx, 0, 0, sy);
        return this;    
    }

    scale(sx: number, sy: number): this {
        var mat = CGMatrixMake();
        this.concat(mat.setScale(sx, sy));
        return this;
    }

    setTranslation(tx: number, ty: number): this;
    setTranslation(pt: { x: number; y: number }): this;
    setTranslation(tx: any, ty?: number): this {
        if (arguments.length === 2) {
            this.set(1, 0, 0, 1, tx, ty);
        }
        else {
            this.set(1, 0, 0, 1, arguments[0].x, arguments[0].y);
        }
        return this;
    }

    translate(tx: number, ty: number): this {
        var mat = CGMatrixMake();
        this.concat(mat.setTranslation(tx, ty));
        return this;
    }

    setInverse(): this {
        var det = this.a * this.d - this.b * this.c;
        this.set(
            this.d / det,
            -this.b / det,
            -this.c / det,
            this.a / det,
            (this.c * this.ty - this.d * this.tx) / det,
            (this.b * this.tx - this.a * this.ty) / det
        );
        return this; 
    }

    transformPoint(pt: { x: number; y: number }): CGPoint;
    transformPoint(x: number, y: number): CGPoint;
    transformPoint(pt: any, _y?: number): CGPoint {   // 본문이 var y를 선언하므로 둘째 인자 이름은 _y
        var x = (arguments.length === 2) ? arguments[0] : pt.x;
        var y = (arguments.length === 2) ? arguments[1] : pt.y;

        return CGPointMake(
            this.a * x + this.c * y + this.tx,
            this.b * x + this.d * y + this.ty
        );
    }

    transformRect(rect: CGRect): CGRect {
        var ct = this.transformPoint(rect.center());
        return CGRectAtCenter(rect, ct);
    }

    transform(obj: CGRect): CGRect;
    transform(obj: { x: number; y: number }): CGPoint;
    transform(obj: any): any {
        if (obj instanceof CGRect) {
            return this.transformRect(obj);
        }
        return this.transformPoint(obj);
    }
}

function CGMatrixMake(...args: any[]): CGMatrix
{
    var mat = new CGMatrix();
    mat.set.apply(mat, arguments as any);
    return mat;
}

function CGMatrixMakeRotation(theta: number, center?: { x: number; y: number }): CGMatrix
{
    var mat = CGMatrixMake();
    if (center) {
        mat.setTranslation(center.x, center.y).rotate(theta).translate(-center.x, -center.y);        
    }
    else {
        mat.setRotation(theta);
    }
    return mat;
}

function CGRectRotatedBound(rect: CGRect, angle: number): CGRect
{
    if (angle === 0) {
        return CGRectMake(rect);
    }

    var mat = CGMatrixMakeRotation(angle, rect.center());
    var min = mat.transform(rect.point(0)!);
    var max = CGPointMake(min);

    for (var i=1; i<4; i++) {
        var pt = mat.transform(rect.point(i)!);   
        if (pt.x < min.x) min.x = pt.x;
        if (pt.x > max.x) max.x = pt.x;
        if (pt.y < min.y) min.y = pt.y;
        if (pt.y > max.y) max.y = pt.y;                 
    }
    return CGRectMake(min.x, min.y, max.x-min.x, max.y-min.y);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////

function CGOrientationRotateCW(orientation: number): number
{
    var rtabs = [8, 7, 6, 5, 2, 1, 4, 3];
    return rtabs[orientation-1];
}

function CGOrientationRotateCCW(orientation: number): number
{
    var ltabs = [6, 5, 8, 7, 4, 3, 2, 1];
    return ltabs[orientation-1];
}

function CGOrientationRotate(CWorCCW: boolean, orientation: number): number
{
    if (CWorCCW) {
        return CGOrientationRotateCW(orientation);
    }
    else {
        return CGOrientationRotateCCW(orientation);
    }
}

function CGOrientationFlipH(orientation: number): number
{
    var ftabs = [2, 1, 4, 3, 8, 7, 6, 5];
    return ftabs[orientation-1];
}

function CGOrientationFlipV(orientation: number): number
{
    var ftabs = [4, 3, 2, 1, 6, 5, 8, 7];
    return ftabs[orientation-1];
}

function CGOrientationFlip(HorV: boolean, orientation: number): number
{
    if (HorV) {
        return CGOrientationFlipH(orientation);
    }
    else {
        return CGOrientationFlipV(orientation);
    }
}

function CGOrientedSize(size: CGSize, orientation: number): CGSize
{
    if (orientation > 4) {
        return CGSizeSwap(size);
    }
    return CGSizeMake(size);
}

function CGOrientedRect(rect: CGRect, orientation: number): CGRect
{
    if (orientation > 4) {
        return CGRectMake(rect.origin.y, rect.origin.x, rect.size.height, rect.size.width);
    }
    return CGRectMake(rect);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////

function CGPointInterpolate(p0: { x: number; y: number }, p1: { x: number; y: number }, ratio: number): CGPoint
{
    return CGPointMake((1-ratio)*p0.x+(ratio)*p1.x, (1-ratio)*p0.y+ratio*p1.y);
}

function CGRatioCloset(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number
{
    var ap = CGPointMake(p.x-a.x, p.y-a.y);
    var ab = CGPointMake(b.x-a.x, b.y-a.y);

    var ab2 = ab.x*ab.x + ab.y*ab.y;
    var ap_ab = ap.x*ab.x + ap.y*ab.y;
    return ap_ab / ab2;
}

function CGPointProject(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): CGPoint
{
    return CGPointInterpolate(a, b, CGRatioCloset(p, a, b)); 
}

function CGPointLinesIntersect(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, p4: { x: number; y: number }): CGPoint | null
{
    var Ax = p2.x-p1.x;
    var Bx = p3.x-p4.x;
    var Ay = p2.y-p1.y;
    var By = p3.y-p4.y;
    var Cx = p1.x-p3.x;
    var Cy = p1.y-p3.y;
    
    var f = Ay*Bx - Ax*By; // both denominator*/
    if (f === 0) return null;
 
    var d = By*Cx - Bx*Cy; // alpha numerator*/   
    var x = p1.x + d*Ax/f;
    var y = p1.y + d*Ay/f;
    return CGPointMake(x, y);
}

function CGAspectRatioMismatch(size0: CGSize, size1: CGSize): boolean
{
    var size0AR = size0.aspectRatio();
    var size1AR = size1.aspectRatio();
    if ((size0AR > 1 && size1AR < 1) || (size0AR < 1 && size1AR > 1)) {
        return true;
    }
    return false;
}

function CGHexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function CGMakeRGBA_CSSData(rgba: { r: number; g: number; b: number; a: number }): string {
    return "(" + rgba.r + "," + rgba.g + "," + rgba.b + "," + rgba.a + ")";
}

export {
    CGPoint,
    CGSize,
    CGRect,
    CGMatrix
};