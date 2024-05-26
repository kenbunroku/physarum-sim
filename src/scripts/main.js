import { Pane } from "tweakpane";
import {
  createShader,
  createRenderTarget,
  createVbo,
  useShader,
  unuseShader,
} from "../utils/webglUtils";
import { plane } from "../utils/geometry";

// shaders
import quadVert from "../shaders/quad.vert";
import diffuseDecayFrag from "../shaders/diffuse_decay.frag";
import updateAgentsFrag from "../shaders/update_agents.frag";
import renderAgentsVert from "../shaders/render_agents.vert";
import renderAgentsFrag from "../shaders/render_agents.frag";
import postProcessFrag from "../shaders/postprocess.frag";

let gl, canvas;
let renderVao, quadVao;
const size = 512;
const count = size * size;

const params = {
  decay: 0.9,
  sa: 2,
  ra: 4,
  so: 12,
  ss: 1.1,
};

const timeInfo = {
  start: 0,
  prev: 0,
  delta: 0,
  elapsed: 0,
};

const renderSpec = {
  width: 0,
  height: 0,
  aspect: 1,
  array: new Float32Array(3),
  textureWidth: 0,
  textureHeight: 0,
};
renderSpec.setSize = function (w, h) {
  renderSpec.width = w;
  renderSpec.height = h;
  renderSpec.aspect = renderSpec.width / renderSpec.height;
  renderSpec.array[0] = renderSpec.width;
  renderSpec.array[1] = renderSpec.height;
  renderSpec.array[2] = renderSpec.aspect;

  renderSpec.textureWidth = size;
  renderSpec.textureHeight = size;
};

let sceneStandBy = true;

const diffuseDecay = {};
const updateAgents = {};
const renderAgents = {};
const postProcess = {};
function createScene() {
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const ptexdata = new Float32Array(count * 4);

  let id = 0,
    u,
    v;
  for (let i = 0; i < count; i++) {
    id = i * 3;
    positions[id++] = positions[id++] = positions[id++] = 0.0;
    u = (i % size) / size;
    v = ~~(i / size) / size;
    id = i * 2;
    uvs[id++] = u;
    uvs[id] = v;

    // particle texture values
    id = i * 4;
    ptexdata[id++] = Math.random();
    ptexdata[id++] = Math.random();
    ptexdata[id++] = Math.random();
    ptexdata[id++] = 1.0;
  }

  const vbos = [
    createVbo(gl, positions, gl.DYNAMIC_DRAW),
    createVbo(gl, uvs, gl.DYNAMIC_DRAW),
  ];

  renderVao = gl.createVertexArray();
  gl.bindVertexArray(renderVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbos[0]);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbos[1]);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(1);
  gl.bindVertexArray(null);

  const geometry = plane(2.0, 2.0, [1.0, 0.0, 0.0, 1.0]);
  const quadVbos = [
    createVbo(gl, geometry.position, gl.DYNAMIC_DRAW),
    createVbo(gl, geometry.texCoord, gl.DYNAMIC_DRAW),
  ];
  quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbos[0]);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbos[1]);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(1);
  gl.bindVertexArray(null);

  diffuseDecay.program = createShader(
    gl,
    quadVert,
    diffuseDecayFrag,
    ["points", "srcTex", "resolution", "time", "decay"],
    ["position", "uv"]
  );
  updateAgents.program = createShader(
    gl,
    quadVert,
    updateAgentsFrag,
    ["srcTex", "data", "resolution", "time", "sa", "ra", "so", "ss"],
    ["position", "uv"]
  );
  renderAgents.program = createShader(
    gl,
    renderAgentsVert,
    renderAgentsFrag,
    ["srcTex"],
    ["position", "uv"]
  );
  postProcess.program = createShader(
    gl,
    quadVert,
    postProcessFrag,
    ["data"],
    ["position", "uv"]
  );

  // create render targets
  const rtfunc = function (rtname, rtw, rth, data = null) {
    renderSpec[rtname] = createRenderTarget(gl, rtw, rth, data);
  };

  rtfunc("mainRT", renderSpec.width, renderSpec.height);
  [0, 1].forEach((i) => {
    rtfunc(
      `updateAgents${i}`,
      renderSpec.textureWidth,
      renderSpec.textureHeight,
      ptexdata
    );
  });
  [0, 1].forEach((i) => {
    rtfunc(`diffuseDecay${i}`, renderSpec.width, renderSpec.height);
  });
}
function initScene() {}
function renderScene() {
  // diffuse decay
  gl.viewport(0, 0, renderSpec.width, renderSpec.height);
  gl.bindVertexArray(quadVao);
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.diffuseDecay1.frameBuffer);
  useShader(gl, diffuseDecay.program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.mainRT.texture);
  gl.uniform1i(diffuseDecay.program.uniforms.points, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.diffuseDecay0.texture);
  gl.uniform1i(diffuseDecay.program.uniforms.srcTex, 1);
  gl.uniform1f(diffuseDecay.program.uniforms.time, timeInfo.elapsed);
  gl.uniform1f(diffuseDecay.program.uniforms.decay, params.decay);
  gl.uniform2fv(diffuseDecay.program.uniforms.resolution, [
    renderSpec.width,
    renderSpec.height,
  ]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  unuseShader(gl, diffuseDecay.program);

  // update agents
  gl.viewport(0, 0, renderSpec.textureWidth, renderSpec.textureHeight);
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.updateAgents1.frameBuffer);
  gl.bindVertexArray(quadVao);
  useShader(gl, updateAgents.program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.updateAgents0.texture);
  gl.uniform1i(updateAgents.program.uniforms.srcTex, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.diffuseDecay1.texture);
  gl.uniform1i(updateAgents.program.uniforms.data, 1);
  gl.uniform1f(updateAgents.program.uniforms.time, timeInfo.elapsed);
  gl.uniform1f(updateAgents.program.uniforms.sa, params.sa);
  gl.uniform1f(updateAgents.program.uniforms.ra, params.ra);
  gl.uniform1f(updateAgents.program.uniforms.so, params.so);
  gl.uniform1f(updateAgents.program.uniforms.ss, params.ss);
  gl.uniform2fv(updateAgents.program.uniforms.resolution, [
    renderSpec.width,
    renderSpec.height,
  ]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  unuseShader(gl, updateAgents.program);

  // render agents
  gl.viewport(0, 0, renderSpec.width, renderSpec.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.mainRT.frameBuffer);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindVertexArray(renderVao);
  useShader(gl, renderAgents.program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.updateAgents1.texture);
  gl.uniform1i(renderAgents.program.uniforms.srcTex, 0);
  gl.drawArrays(gl.POINTS, 0, count);
  unuseShader(gl, renderAgents.program);

  // display
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(quadVao);
  gl.clear(gl.COLOR_BUFFER_BIT);
  useShader(gl, postProcess.program);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.diffuseDecay1.texture);
  gl.uniform1i(postProcess.program.uniforms.data, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  unuseShader(gl, postProcess.program);

  // swap diffuseDecay0 and diffuseDecay1
  const tmp1 = renderSpec.diffuseDecay0;
  renderSpec.diffuseDecay0 = renderSpec.diffuseDecay1;
  renderSpec.diffuseDecay1 = tmp1;

  // swap updateAgents0 and updateAgents1
  const tmp2 = renderSpec.updateAgents0;
  renderSpec.updateAgents0 = renderSpec.updateAgents1;
  renderSpec.updateAgents1 = tmp2;

  gl.bindVertexArray(null);
}

function render() {
  renderScene();
}

let animating = true;
function animate() {
  const curdate = new Date();
  timeInfo.elapsed = (curdate - timeInfo.start) / 1000.0;
  timeInfo.delta = (curdate - timeInfo.prev) / 1000.0;
  timeInfo.prev = curdate;

  if (animating) requestAnimationFrame(animate);
  render();
}

function setViewports() {
  renderSpec.setSize(gl.canvas.width, gl.canvas.height);

  gl.clearColor(0.02, 0.0, 0.05, 1.0);
  gl.clearDepth(1.0);
  gl.viewport(0, 0, renderSpec.width, renderSpec.height);
}

function onResize(e) {
  makeCanvasFullScreen(document.getElementById("webgl"));
  setViewports();

  if (sceneStandBy) {
    createScene();
  }
}

function makeCanvasFullScreen(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("load", function (e) {
  canvas = document.getElementById("webgl");
  try {
    makeCanvasFullScreen(canvas);
    gl = canvas.getContext("webgl2", { preserveDrawingBuffer: false });
  } catch (e) {
    alert("WebGL not supported." + e);
    console.error(e);
    return;
  }

  try {
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      throw new Error("EXT_color_buffer_float is not supported");
    }
  } catch (e) {
    console.error(e);
  }

  window.addEventListener("resize", onResize);

  setViewports();
  createScene();
  createDebugPane();
  initScene();

  timeInfo.start = new Date();
  timeInfo.prev = timeInfo.start;
  animate();
});

function createDebugPane() {
  const pane = new Pane();
  pane.addBinding(params, "decay", { min: 0.0, max: 0.99, step: 0.01 });
  pane.addBinding(params, "sa", {
    min: 1.0,
    max: 10.0,
    step: 0.1,
    label: "sensor angle",
  });
  pane.addBinding(params, "ra", {
    min: 1.0,
    max: 10.0,
    step: 0.1,
    label: "rotation angle",
  });
  pane.addBinding(params, "so", {
    min: 1.0,
    max: 20.0,
    step: 0.1,
    label: "sensor offset",
  });
  pane.addBinding(params, "ss", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
    label: "sensor size",
  });
}
