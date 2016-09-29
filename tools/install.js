var fs = require('fs')
	, path = require('path')
	, spawn = require('child_process').spawn
	, whereis = require('./whereis');

if (process.platform === 'win32') {
	var libroot = path.resolve(__dirname, '../lib/native/win32')
		, lib32bit = path.resolve(libroot, 'ia32')
		, lib64bit = path.resolve(libroot, 'x64');

	function copyFile(filePath, filename) {
		return function(copyToDir) {
			fs.writeFileSync(path.resolve(copyToDir, filename), fs.readFileSync(filePath));
		};
	}

	function isDirectory(info) {
		return info.isDirectory;
	}

	function getInfo(basedir) {
		return function(file) {
			var filepath = path.resolve(basedir, file);

			return {
				path: filepath,
				isDirectory: fs.statSync(filepath).isDirectory()
			};
		}
	}

	function getPath(info) {
		return info.path;
	}

	var dest32dirs = fs.readdirSync(lib32bit)
		.map(getInfo(lib32bit))
		.filter(isDirectory)
		.map(getPath);

	['msvcr120.dll', 'msvcp120.dll'].forEach(function (dllname) {
		var dll32bit = path.resolve(lib32bit, dllname);
		dest32dirs.forEach(copyFile(dll32bit, dllname));
	});
		
	var dest64dirs = fs.readdirSync(lib64bit)
		.map(getInfo(lib64bit))
		.filter(isDirectory)
		.map(getPath);

	['msvcr120.dll', 'msvcp120.dll'].forEach(function (dllname) {
		var dll64bit = path.resolve(lib64bit, dllname);
		dest64dirs.forEach(copyFile(dll64bit, dllname));
	});

	var dotnetPath = whereis('dotnet', 'dotnet.exe');

	if (dotnetPath) {
		spawn(dotnetPath, ['restore'], { stdio: 'inherit', cwd: path.resolve(__dirname, '..', 'lib', 'bootstrap') })
			.on('close', function() {
				spawn(dotnetPath, ['build', '--configuration', 'Release'], { stdio: 'inherit', cwd: path.resolve(__dirname, '..', 'lib', 'bootstrap') })
					.on('close', function() {
						require('./checkplatform');
					});
			});
	}

	else {
		require('./checkplatform');
	}
} 

else {
	if (process.platform === 'darwin') {

		// Code from electron-prebuild: https://github.com/electron/electron-rebuild
		const possibleModuleNames = ['electron', 'electron-prebuilt', 'electron-prebuilt-compile'];

		function locateElectronPrebuilt () {
			let electronPath;

			// Attempt to locate modules by path
			let foundModule = possibleModuleNames.some((moduleName) => {
				electronPath = path.join(__dirname, '..', '..', moduleName);
				return fs.existsSync(electronPath);
			});

			// Return a path if we found one
			if (foundModule) return electronPath;

			// Attempt to locate modules by require
			foundModule = possibleModuleNames.some((moduleName) => {
				try {
				electronPath = path.join(require.resolve(moduleName), '..');
				} catch (e) {
				return false;
				}
				return fs.existsSync(electronPath);
			});

			// Return a path if we found one
			if (foundModule) return electronPath;
			return null;
		}

		location = locateElectronPrebuilt();
		version = null;
		electronPath = null;
		if (location != null)
		{ 
			// NB: We assume here that electron-prebuilt is a sibling package of ours
			pkg = null;
			try {
				let pkgJson = path.join(location, 'package.json');

				pkg = require(pkgJson);

				version = pkg.version;
			} catch (e) {
				console.error("Unable to find electron-prebuilt's version number, either install it or specify an explicit version");
			}
		}
		if (version !== null)
		{
			spawn('node-gyp', ['configure', 'build', '--target='+version, '--disturl=https://atom.io/download/atom-shell'], { stdio: 'inherit' });
		}
		else
			spawn('node-gyp', ['configure', 'build'], { stdio: 'inherit' });
   		
	}
	else {
		spawn('node-gyp', ['configure', 'build'], { stdio: 'inherit' });
	}
}
