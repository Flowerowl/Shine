var mouseX = 0, mouseY = 0;
var windowHalfX = window.innerWidth / 2, windowHalfY = window.innerHeight / 2;
var camera, scene, renderer, material, container;
var audioBuffer, audioContext, analyser;
var source, buffer;
var started = false;
var perlin = new ImprovedNoise();
var noisePos = Math.random()*100;

$(document).ready(function() {
	init();
});

function init() {
	container = $('#container');
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000000);
	camera.position.z = 2000;
	scene = new THREE.Scene();
	scene.add(camera);
	stats = new Stats();
	renderer = new THREE.WebGLRenderer({
		antialias : false,
		sortObjects : false
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	container.append(renderer.domElement);
	$("#stats").append(stats.domElement);

	audioContext = new (window.AudioContext || window.webkitAudioContext)();
	analyser = audioContext.createAnalyser();
	analyser.smoothingTimeConstant = 0.1;
	analyser.fftSize = 1024;

	$(document).mousemove(onDocumentMouseMove);
	$(window).resize(onWindowResize);
	document.addEventListener('drop', onMP3Drop, false);
	document.addEventListener('dragover', onDocumentDragOver, false);
	onWindowResize(null);

	Shine.init();
}

function onDocumentMouseMove(event) {
	mouseX = (event.clientX - windowHalfX);
	mouseY = (event.clientY - windowHalfY);
}

function onWindowResize(event) {
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	return false;
}

function onMP3Drop(evt) {
	evt.stopPropagation();
	evt.preventDefault();

	var droppedFiles = evt.dataTransfer.files;
	var reader = new FileReader();
	reader.readAsArrayBuffer(droppedFiles[0]);

	reader.onload = function(fileEvent) {
		var data = fileEvent.target.result;
		audioContext.decodeAudioData(data, function(buffer) {
			audioBuffer = buffer;
			startSound();
		}, function(e) {
			console.log(e);
		});
	};
}

$(window).mousewheel(function(event, delta) {
	camera.position.z -= delta * 50;
});

function startSound() {
	if (source){
		source.stop(0.0);
		source.disconnect();
	}

	source = audioContext.createBufferSource();	
	source.connect(audioContext.destination);
	source.connect(analyser);

	source.buffer = audioBuffer;
	source.loop = true;
	source.start(0.0);

	if (!started){
		started = true;
		animate();
	}
}

function animate() {
	requestAnimationFrame(animate);
	render();
	stats.update();
}

function render() {
	Shine.update();
	noisePos += 0.005;

	var xrot = mouseX/window.innerWidth * Math.PI*2 + Math.PI;
	var yrot = mouseY/window.innerHeight* Math.PI*2 + Math.PI;
	Shine.loopHolder.rotation.x += (-yrot - Shine.loopHolder.rotation.x) * 0.3;
	Shine.loopHolder.rotation.y += (xrot - Shine.loopHolder.rotation.y) * 0.3;

	renderer.render(scene, camera);
}

var Shine = (function() {
	var RINGCOUNT = 160;
	var SEPARATION = 30;
	var INIT_RADIUS = 50;
	var SEGMENTS = 512;
	var BIN_COUNT = 512;

	var rings = [];
	var levels = [];
	var colors = [];
	var loopHolder = new THREE.Object3D();
	var loopGeom;
	var freqByteData;
	var timeByteData;

	var params = {
		gain:1,
		separation: 0.05,
		scale: 1,
		zbounce: 1
	};

	function init() {
		freqByteData = new Uint8Array(analyser.frequencyBinCount);
		timeByteData = new Uint8Array(analyser.frequencyBinCount);

		var loopShape = new THREE.Shape();
		loopShape.absarc( 0, 0, INIT_RADIUS, 0, Math.PI*2, false );
		loopGeom = loopShape.createPointsGeometry(SEGMENTS/2);
		loopGeom.dynamic = true;

		scene.add(loopHolder);
		var scale = 1;
		for(var i = 0; i < RINGCOUNT; i++) {

			var m = new THREE.LineBasicMaterial( { color: 0xffffff,
				linewidth: 1 ,
				opacity : 0.7,
				blending : THREE.AdditiveBlending,
				depthTest : false,
				transparent : true
			});
			
			var line = new THREE.Line(loopGeom, m);

			rings.push(line);
			scale *= 1.05;
			line.scale.x = scale;
			line.scale.y = scale;
			loopHolder.add(line);

			levels.push(0);
			colors.push(0);
		}
	}

	function update() {
		
		analyser.getByteFrequencyData(freqByteData);
		analyser.getByteTimeDomainData(timeByteData);

		var sum = 0;
		for(var i = 0; i < BIN_COUNT; i++) {
			sum += freqByteData[i];
		}
		var aveLevel = sum / BIN_COUNT;
		var scaled_average = (aveLevel / 256) * params.gain*2;
		levels.push(scaled_average);
		levels.shift(1);
		
		var n = Math.abs(perlin.noise(noisePos, 0, 0));
		colors.push(n);
		colors.shift(1);

		for(var j = 0; j < SEGMENTS; j++) {
			loopGeom.vertices[j].z = timeByteData[j]*2;
		}

		loopGeom.vertices[SEGMENTS].z = loopGeom.vertices[0].z;
		loopGeom.verticesNeedUpdate = true;

		for( i = 0; i < RINGCOUNT ; i++) {
			var ringId = RINGCOUNT - i - 1;
			var normLevel = levels[ringId] + 0.01;
			var hue = colors[i];
			rings[i].material.color.setHSL(hue, 1, normLevel*.8);
			rings[i].material.linewidth = normLevel*3;
			rings[i].material.opacity = normLevel;
			rings[i].scale.z = normLevel * params.zbounce;
		}
	}

	return {
		init:init,
		update:update,
		loopHolder:loopHolder,
		params:params
	};
}());

