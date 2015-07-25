var camera, scene, renderer, container;
var audioBuffer, audioContext, analyser;
var source;
var started = false;

$(document).ready(function() {
	init();
});

function init() {
	container = $('#container');
	camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 1, 1000000);
	camera.position.z = 500;
	scene = new THREE.Scene();
	scene.add(camera);

	renderer = new THREE.WebGLRenderer({
		antialias : false,
		sortObjects : false
	});
	renderer.setSize(window.innerWidth, window.innerHeight);
	container.append(renderer.domElement);

	audioContext = new (window.AudioContext || window.webkitAudioContext)();
	analyser = audioContext.createAnalyser();
	analyser.smoothingTimeConstant = 0.1;
	analyser.fftSize = 1024;

	document.addEventListener('drop', onMP3Drop, false);
	document.addEventListener('dragover', onDocumentDragOver, false);

	Shine.init();
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
}

function render() {
	Shine.update();

	renderer.render(scene, camera);
}

var Shine = (function() {
	var segments = 512;

	var loopHolder = new THREE.Object3D();
	var loopGeom;
	var timeByteData;

	function init() {
		timeByteData = new Uint8Array(analyser.frequencyBinCount);

		var loopShape = new THREE.Shape();
		loopShape.absarc(0, 0, 100, 0, Math.PI*2, false);
		loopGeom = loopShape.createPointsGeometry(segments/2);
		loopGeom.dynamic = true;

		scene.add(loopHolder);
		var scale = 1;
		var m = new THREE.LineDashedMaterial({ 
			color: 0xFBB917,
			linewidth: 3,
			opacity : 0.7,
			blending : THREE.AdditiveBlending,
			depthTest : false,
			transparent : true
		});
			
		var line = new THREE.Line(loopGeom, m);
		loopHolder.add(line);
	}

	function update() {
		analyser.getByteTimeDomainData(timeByteData);

		for(var j = 0; j < segments; j++) {
			loopGeom.vertices[j].z = timeByteData[j]*2;
		}

		loopGeom.vertices[segments].z = loopGeom.vertices[0].z;
		loopGeom.verticesNeedUpdate = true;
	}

	return {
		init:init,
		update:update,
		loopHolder:loopHolder,
	};
}());