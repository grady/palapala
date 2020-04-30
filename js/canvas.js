let mementos = [];

$(document).ready(init);

function init() {
    $("#colorPicker").spectrum({
        preferredFormat: "hex",
        showPalette: true,
        showPaletteOnly: true,
        togglePaletteOnly: true,
        togglePaletteMoreText: ">",
        togglePaletteLessText: "<",
        hideAfterPaletteSelect: true,
        palette: [
            ["black", "red"],
            ["mediumseagreen", "mediumblue"],
            ["mediumorchid", "darkorange"]
        ],
        replacerClassName: "sp-replacer btn btn-secondary bg-secondary",
        change: color => project.currentStyle.strokeColor.set(color.toRgbString())
    });

    $("#clearButton").click(event => project.clear());
    $("input[name=tool]").click(event => activateTool(event.target.value));
    //$("input[name=tool]").click(event => tools.find(tool => tool.name == event.target.value).activate());

    $("#sizeSlider").change(event => project.currentStyle.strokeWidth = event.target.value);
    $("#undoButton").click(undo);
    $("#redoButton").click(redo);
    project.currentStyle.strokeColor = $("#colorPicker").spectrum("get").toHexString();
    project.currentStyle.strokeWidth = $("#sizeSlider").val();
    project.currentStyle.strokeCap = "round";
    project.currentStyle.strokeJoin = "round";
    penTool.activate();

    globals.paper = paper;
}


function activateTool(name) {
    tools.find(tool => tool.name === name).activate();
    desmosTool.desmos.css("z-index", name === "desmos" ? 1 : -1);
}

const penTool = new paper.Tool({
    name: "pen",
    path: null,
    onMouseDown: function (event) {
        penTool.path = new Path();
    },
    onMouseDrag: function (event) {
        if (penTool.path) penTool.path.add(event.point);
    },
    onMouseUp: function (event) {
        penTool.path.simplify();
        if (penTool.path.segments.length === 0) {
            penTool.path = new Path.Circle({
                center: event.point,
                radius: penTool.path.strokeWidth / 2,
                strokeWidth: null,
                fillColor: penTool.path.strokeColor
            });
        }
        penTool.path = null;
    }
});

const eraseTool = new paper.Tool({
    name: "erase",
    path: null,
    group: null,
    mask: null,
    onMouseDown: function (event) {
        eraseTool.path = new Path({
            strokeWidth: project.currentStyle.strokeWidth * 3,
            strokeColor: "white"
        });
        eraseTool.group = new Group({
            children: project.activeLayer.removeChildren(),
            blendMode: "source-out",
            insert: false
        });
        eraseTool.mask = new Group({
            children: [eraseTool.path, eraseTool.group],
            blendMode: "source-over"
        });
    },
    onMouseDrag: function (event) {
        if (eraseTool.path) eraseTool.path.add(event.point);
    },
    onMouseUp: function (event) {
        eraseTool.path.simplify();
        let radius = eraseTool.path.strokeWidth / 2;
        let outerPath = OffsetUtils.offsetPath(eraseTool.path, radius);
        let innerPath = OffsetUtils.offsetPath(eraseTool.path, -radius);
        eraseTool.path.remove()

        outerPath.insert = false
        innerPath.insert = false
        innerPath.reverse()

        let endCaps = new CompoundPath({
            children: [
                new Path.Circle({
                    center: eraseTool.path.firstSegment.point,
                    radius: radius
                }),
                new Path.Circle({
                    center: eraseTool.path.lastSegment.point,
                    radius: radius
                })
            ],
            insert: false
        })

        let deleteShape = new Path({
            closed: true,
            insert: false
        })
        deleteShape.addSegments(outerPath.segments)
        deleteShape.addSegments(innerPath.segments)
        deleteShape = deleteShape.unite(endCaps)
        deleteShape.simplify()

        eraseTool.group.getItems({ overlapping: deleteShape.bounds }).forEach(
            function (item) {
                let result = item.subtract(deleteShape, { trace: false, insert: false });
                if (result.children) {
                    item.parent.insertChildren(item.index, result.removeChildren());
                    item.remove();
                } else if (result.length == 0) {
                    item.remove();
                } else {
                    item.replaceWith(result);
                }
            }
        )
        project.activeLayer.addChildren(eraseTool.group.removeChildren());
        eraseTool.path = null;
        eraseTool.group.remove();
        eraseTool.group = null;
        eraseTool.mask.remove();
        eraseTool.mask = null;

    }
});

const circleTool = new Tool({
    name: "circle",
    path: null,
    onMouseDown: function (event) {
        circleTool.path = new Shape.Circle(event.point, 10);
    },
    onMouseDrag: function (event) {
        circleTool.path.radius = (event.point - event.downPoint).length;
    },
    onMouseUp: function (event) {
        circleTool.path = null;
    }
});

const lineTool = new Tool({
    name: "line",
    path: null,
    onMouseDown: event => lineTool.path = new Path([event.point, event.point]),
    onMouseDrag: function (event) {
        lineTool.path.lastSegment.point.set(event.point);
        if (event.modifiers.shift) lineTool.path.firstSegment.point.set(lineMirror(event));
        lineTool.path.firstSegment.point.set(event.modifiers.shift ? lineMirror(event) : event.downPoint);
    },
    onMouseUp: event => lineTool.path = null
});

function lineMirror(event) {
    return event.downPoint - (event.point - event.downPoint);
}

const rectTool = new Tool({
    name: "rectangle",
    path: null,
    onMouseDown: event => rectTool.path = new Shape.Rectangle(event.point, event.point),
    onMouseDrag: function (event) {
        let size = event.point - event.downPoint;
        if (event.modifiers.shift) {
            rectTool.path.size.set(size * 2);
            rectTool.path.position.set(event.downPoint);
        }
        else {
            rectTool.path.size.set(size);
            rectTool.path.position.set((event.downPoint + event.point) / 2);
        }
    },
    onMouseUp: event => { rectTool.path = null }
});

const highlightTool = new Tool({
    name: "highlight",
    path: null,
    onMouseDown: function (event) {
        highlightTool.path = new Path({ strokeWidth: project.currentStyle.strokeWidth * 5 });
        highlightTool.path.strokeColor.alpha = 0.4;

    },
    onMouseDrag: event => highlightTool.path.add(event.point),
    onMouseUp: event => highlightTool.path = null
});

const axesTool = new Tool({
    name: "axes",
    path: null,
    onMouseDown: function (event) {
        axesTool.path = new CompoundPath({
            children: [
                new Path([event.point, event.point]),
                new Path([event.point, event.point])
            ]
        })
    },
    onMouseDrag: function (event) {
        let xaxis = axesTool.path.firstChild;
        let yaxis = axesTool.path.lastChild;
        let mirror = lineMirror(event);
        xaxis.firstSegment.point.x = event.point.x;
        xaxis.lastSegment.point.x = event.modifiers.shift ? mirror.x : event.downPoint.x;
        yaxis.firstSegment.point.y = event.point.y;
        yaxis.lastSegment.point.y = event.modifiers.shift ? mirror.y : event.downPoint.y;
    },
    onMouseUp: event => axesTool.path = null
});

const desmosTool = new Tool({
    name: "desmos",
    desmos: $("#desmos"),
    calc: null,
    path: null,
    onMouseDown: function (event) {
        desmosTool.path = new Shape.Rectangle(event.point, event.point);
        desmosTool.path.strokeWidth = 1;
    },
    onMouseDrag: function (event) {
        desmosTool.path.size.set(event.point - event.downPoint);
        desmosTool.path.position.set((event.downPoint + event.point) / 2);
    },
    onMouseUp: function (event) {
        //    debugger;
        desmosTool.path.remove();
        desmosTool.path = null;
        let rect = new Rectangle(event.downPoint, event.point);
        desmosTool.desmos.css({
            display: "inherit",
            left: rect.left + 'px',
            top: rect.top + 'px',
            width: rect.width,
            height: rect.height,
        });
        if (!desmosTool.calc) desmosTool.calc = Desmos.GraphingCalculator(desmosTool.desmos[0]);
    }
});

function undo(event) {
    let item = project.activeLayer.lastChild;
    if (item) {
        mementos.push(item);
        item.remove();
        $("#redoButton").removeAttr("disabled");
    }
}

function redo(event) {
    let item = mementos.pop();
    if (mementos.length == 0) $("#redoButton").prop('disabled', true);
    if (item) project.activeLayer.addChild(item);
}

function clearUndo() {
    mementos.length = 0;
    $("#redoButton").prop('disabled', true);
}

let OffsetUtils = {
    offsetPath: function (path, offset, result) {
        let outerPath = new Path({ insert: false }),
            epsilon = Numerical.GEOMETRIC_EPSILON,
            enforeArcs = true;
        for (let i = 0; i < path.curves.length; i++) {
            let curve = path.curves[i];
            if (curve.hasLength(epsilon)) {
                let segments = this.getOffsetSegments(curve, offset),
                    start = segments[0];
                if (outerPath.isEmpty()) {
                    outerPath.addSegments(segments);
                } else {
                    let lastCurve = outerPath.lastCurve;
                    if (!lastCurve.point2.isClose(start.point, epsilon)) {
                        if (enforeArcs || lastCurve.getTangentAtTime(1).dot(start.point.subtract(curve.point1)) >= 0) {
                            this.addRoundJoin(outerPath, start.point, curve.point1, Math.abs(offset));
                        } else {
                            // Connect points with a line
                            outerPath.lineTo(start.point);
                        }
                    }
                    outerPath.lastSegment.handleOut = start.handleOut;
                    outerPath.addSegments(segments.slice(1));
                }
            }
        }
        if (path.isClosed()) {
            if (!outerPath.lastSegment.point.isClose(outerPath.firstSegment.point, epsilon) && (enforeArcs ||
                outerPath.lastCurve.getTangentAtTime(1).dot(outerPath.firstSegment.point.subtract(path.firstSegment.point)) >= 0)) {
                this.addRoundJoin(outerPath, outerPath.firstSegment.point, path.firstSegment.point, Math.abs(offset));
            }
            outerPath.closePath();
        }
        return outerPath;
    },

    /**
     * Creates an offset for the specified curve and returns the segments of
     * that offset path.
     *
     * @param {Curve} curve the curve to be offset
     * @param {Number} offset the offset distance
     * @returns {Segment[]} an array of segments describing the offset path
     */
    getOffsetSegments: function (curve, offset) {
        if (curve.isStraight()) {
            let n = curve.getNormalAtTime(0.5).multiply(offset),
                p1 = curve.point1.add(n),
                p2 = curve.point2.add(n);
            return [new Segment(p1), new Segment(p2)];
        } else {
            let curves = this.splitCurveForOffseting(curve),
                segments = [];
            for (let i = 0, l = curves.length; i < l; i++) {
                let offsetCurves = this.getOffsetCurves(curves[i], offset, 0),
                    prevSegment;
                for (let j = 0, m = offsetCurves.length; j < m; j++) {
                    let curve = offsetCurves[j],
                        segment = curve.segment1;
                    if (prevSegment) {
                        prevSegment.handleOut = segment.handleOut;
                    } else {
                        segments.push(segment);
                    }
                    segments.push(prevSegment = curve.segment2);
                }
            }
            return segments;
        }
    },

    /**
     * Approach for Curve Offsetting based on:
     *   "A New Shape Control and Classification for Cubic Bézier Curves"
     *   Shi-Nine Yang and Ming-Liang Huang
     */
    offsetCurve_middle: function (curve, offset) {
        let v = curve.getValues(),
            p1 = curve.point1.add(Curve.getNormal(v, 0).multiply(offset)),
            p2 = curve.point2.add(Curve.getNormal(v, 1).multiply(offset)),
            pt = Curve.getPoint(v, 0.5).add(
                Curve.getNormal(v, 0.5).multiply(offset)),
            t1 = Curve.getTangent(v, 0),
            t2 = Curve.getTangent(v, 1),
            div = t1.cross(t2) * 3 / 4,
            d = pt.multiply(2).subtract(p1.add(p2)),
            a = d.cross(t2) / div,
            b = d.cross(t1) / div;
        return new Curve(p1, t1.multiply(a), t2.multiply(-b), p2);
    },

    offsetCurve_average: function (curve, offset) {
        var v = curve.getValues(),
            p1 = curve.point1.add(Curve.getNormal(v, 0).multiply(offset)),
            p2 = curve.point2.add(Curve.getNormal(v, 1).multiply(offset)),
            t = this.getAverageTangentTime(v),
            u = 1 - t,
            pt = Curve.getPoint(v, t).add(
                Curve.getNormal(v, t).multiply(offset)),
            t1 = Curve.getTangent(v, 0),
            t2 = Curve.getTangent(v, 1),
            div = t1.cross(t2) * 3 * t * u,
            v = pt.subtract(
                p1.multiply(u * u * (1 + 2 * t)).add(
                    p2.multiply(t * t * (3 - 2 * t)))),
            a = v.cross(t2) / (div * u),
            b = v.cross(t1) / (div * t);
        return new Curve(p1, t1.multiply(a), t2.multiply(-b), p2);
    },

    /**
     * This algorithm simply scales the curve so its end points are at the
     * calculated offsets of the original end points.
     */
    offsetCurve_simple: function (crv, dist) {
        // calculate end points of offset curve
        let p1 = crv.point1.add(crv.getNormalAtTime(0).multiply(dist));
        let p4 = crv.point2.add(crv.getNormalAtTime(1).multiply(dist));
        // get scale ratio
        let pointDist = crv.point1.getDistance(crv.point2);
        // TODO: Handle cases when pointDist == 0
        let f = p1.getDistance(p4) / pointDist;
        if (crv.point2.subtract(crv.point1).dot(p4.subtract(p1)) < 0) {
            f = -f; // probably more correct than connecting with line
        }
        // Scale handles and generate offset curve
        return new Curve(p1, crv.handle1.multiply(f), crv.handle2.multiply(f), p4);
    },

    getOffsetCurves: function (curve, offset, method) {
        let errorThreshold = 0.01,
            radius = Math.abs(offset),
            offsetMethod = this['offsetCurve_' + (method || 'middle')],
            that = this;

        function offsetCurce(curve, curves, recursion) {
            let offsetCurve = offsetMethod.call(that, curve, offset),
                cv = curve.getValues(),
                ov = offsetCurve.getValues(),
                count = 16,
                error = 0;
            for (let i = 1; i < count; i++) {
                let t = i / count,
                    p = Curve.getPoint(cv, t),
                    n = Curve.getNormal(cv, t),
                    roots = Curve.getCurveLineIntersections(ov, p.x, p.y, n.x, n.y),
                    dist = 2 * radius;
                for (let j = 0, l = roots.length; j < l; j++) {
                    let d = Curve.getPoint(ov, roots[j]).getDistance(p);
                    if (d < dist)
                        dist = d;
                }
                let err = Math.abs(radius - dist);
                if (err > error)
                    error = err;
            }
            if (error > errorThreshold && recursion++ < 8) {
                if (error === radius) {
                    // console.log(cv);
                }
                let curve2 = curve.divideAtTime(that.getAverageTangentTime(cv));
                offsetCurce(curve, curves, recursion);
                offsetCurce(curve2, curves, recursion);
            } else {
                curves.push(offsetCurve);
            }
            return curves;
        }

        return offsetCurce(curve, [], 0);
    },

    /**
     * Split curve into sections that can then be treated individually by an
     * offset algorithm.
     */
    splitCurveForOffseting: function (curve) {
        let curves = [curve.clone()], // Clone so path is not modified.
            that = this;
        if (curve.isStraight())
            return curves;

        function splitAtRoots(index, roots) {
            for (let i = 0, prevT, l = roots && roots.length; i < l; i++) {
                let t = roots[i],
                    curve = curves[index].divideAtTime(
                        // Renormalize curve-time for multiple roots:
                        i ? (t - prevT) / (1 - prevT) : t);
                prevT = t;
                if (curve)
                    curves.splice(++index, 0, curve);
            }
        }

        // Recursively splits the specified curve if the angle between the two
        // handles is too large (we use 60° as a threshold).
        function splitLargeAngles(index, recursion) {
            let curve = curves[index],
                v = curve.getValues(),
                n1 = Curve.getNormal(v, 0),
                n2 = Curve.getNormal(v, 1).negate(),
                cos = n1.dot(n2);
            if (cos > -0.5 && ++recursion < 4) {
                curves.splice(index + 1, 0,
                    curve.divideAtTime(that.getAverageTangentTime(v)));
                splitLargeAngles(index + 1, recursion);
                splitLargeAngles(index, recursion);
            }
        }

        // Split curves at cusps and inflection points.
        let info = curve.classify();
        if (info.roots && info.type !== 'loop') {
            splitAtRoots(0, info.roots);
        }

        // Split sub-curves at peaks.
        for (let i = curves.length - 1; i >= 0; i--) {
            splitAtRoots(i, Curve.getPeaks(curves[i].getValues()));
        }

        // Split sub-curves with too large angle between handles.
        for (let i = curves.length - 1; i >= 0; i--) {
            //splitLargeAngles(i, 0);
        }
        return curves;
    },

    /**
     * Returns the first curve-time where the curve has its tangent in the same
     * direction as the average of the tangents at its beginning and end.
     */
    getAverageTangentTime: function (v) {
        let tan = Curve.getTangent(v, 0).add(Curve.getTangent(v, 1)),
            tx = tan.x,
            ty = tan.y,
            abs = Math.abs,
            flip = abs(ty) < abs(tx),
            s = flip ? ty / tx : tx / ty,
            ia = flip ? 1 : 0, // the abscissa index
            io = ia ^ 1,       // the ordinate index
            a0 = v[ia + 0], o0 = v[io + 0],
            a1 = v[ia + 2], o1 = v[io + 2],
            a2 = v[ia + 4], o2 = v[io + 4],
            a3 = v[ia + 6], o3 = v[io + 6],
            aA = -a0 + 3 * a1 - 3 * a2 + a3,
            aB = 3 * a0 - 6 * a1 + 3 * a2,
            aC = -3 * a0 + 3 * a1,
            oA = -o0 + 3 * o1 - 3 * o2 + o3,
            oB = 3 * o0 - 6 * o1 + 3 * o2,
            oC = -3 * o0 + 3 * o1,
            roots = [],
            epsilon = Numerical.CURVETIME_EPSILON,
            count = Numerical.solveQuadratic(
                3 * (aA - s * oA),
                2 * (aB - s * oB),
                aC - s * oC, roots,
                epsilon, 1 - epsilon);
        // Fall back to 0.5, so we always have a place to split...
        return count > 0 ? roots[0] : 0.5;
    },

    addRoundJoin: function (path, dest, center, radius) {
        // return path.lineTo(dest);
        let middle = path.lastSegment.point.add(dest).divide(2),
            through = center.add(middle.subtract(center).normalize(radius));
        path.arcTo(through, dest);
    },
};