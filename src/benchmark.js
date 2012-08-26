/**
 * @author Federico "Lox" Lucignano <http://plus.ly/federico.lox>
 * 
 * @see https://github.com/federico-lox/Bench-monkey
 */
 
var MicroBenchmark = (function(){
	/** @private **/

	var freqFormatRgx = new RegExp('(\\d+)(\\d{3})');

	function arrSum(arr){
		var total = 0,
			x = 0,
			y = arr.length;

		while(x < y)
			total += arr[x++];

		return total;
	}

	function arrAvg(arr){
		return arrSum(arr) / arr.length;
	}

	function EventGenerator(){
		this._handlers = {};
	}

	EventGenerator.prototype.addEventListener = function(names, handler){
		if(!(names instanceof Array))
			names = [names];

		for(var x = 0, y =  names.length, n; x < y; x++){
			n = names[x];

			if(handler instanceof Function){
				var handlers = this._handlers[n];

				if(handlers instanceof Array)
					handlers.push(handler);
				else
					this._handlers[n] = [handler];
			}
		}
	};

	EventGenerator.prototype.removeEventListener = function(names, handler){
		if(!(names instanceof Array))
			names = [names];

		for(var x = 0, y =  names.length; x < y; x++){
			if(handler instanceof Function){
				var handlers = this._handlers[names[x]],
					i;

				if(handlers instanceof Array && (i = handlers.indexOf(handler)) >= 0)
					handlers.splice(i, 1);
			}
		}
	};

	EventGenerator.prototype.fireEvent = function(names, data){
		if(!(names instanceof Array))
			names = [names];

		for(var x = 0, y =  names.length, n; x < y; x++){
			n = names[x];

			if((handlers = this._handlers[n]) instanceof Array){
				for(var x = 0, y = handlers.length; x < y; x++)
					handlers[x](n, data);
			}
		}
	};

	function Metrics(){
		this._elapsed = [];
		this._ops = [];
		this._count = 0;
	}

	Metrics.prototype.record = function(operationsCount, elapsedTime){
		var c = this._count;

		this._elapsed[c] = elapsedTime;
		this._ops[c] = operationsCount;
		this._count = ++c;
	};

	Metrics.prototype.getElapsedTime = function(measure){
		switch(measure){
			case 'total':
				return arrSum(this._elapsed);
			case 'latest':
				return this._elapsed[this._count - 1];
			case 'average':
			default:
				return arrAvg(this._elapsed);
		}
	};

	Metrics.prototype.getOperations = function(measure){
		switch(measure){
			case 'total':
				return arrSum(this._ops);
			case 'latest':
				return this._ops[this._count - 1];
			case 'average':
			default:
				return arrAvg(this._ops);
		}
	};

	Metrics.prototype.getOperationTime = function(measure){
		var elapsed = 0,
			ops = 0;

		switch(measure){
			case 'total':
				elapsed = arrSum(this._elapsed);
				ops = arrSum(this._ops);
				break;
			case 'latest':
				elapsed = this._elapsed[this._count - 1];
				ops = this._ops[this._count - 1];
				break;
			case 'average':
			default:
				elapsed = arrAvg(this._elapsed);
				ops = arrAvg(this._ops);
		}

		return (elapsed / ops);
	};

	Metrics.prototype.getRecordsCount = function(){
		return this._count;
	}

	Metrics.prototype.getFrequency = function(measure){
		return (this.getOperations(measure) / this.getElapsedTime(measure)) * 1000.0;
	};

	/*
	 TODO: relative metrics
	 //pass in a metrics object, all the numbers will be relative to those in the passed in
	 //object, used for taking the calibration overhead out
	 Metrics.prototype.relateTo = function(metrics){

	 };
	 */

	Metrics.prototype.toString = function(measure){
		var freq = this.getFrequency(measure);

		return freq.toFixed(2) + ' ops/s';
	};

	Metrics.prototype.toFormattedString = function(measure, tSeparator, dSeparator){
		var freq = this.getFrequency(measure) + '';

		if(!tSeparator)
			tSeparator = ',';

		if(!dSeparator)
			dSeparator = '.';

		var x = freq.split('.'),
			x1 = x[0],
			x2 = x.length > 1 ? dSeparator + x[1].substr(0, 2) : '';

		while(freqFormatRgx.test(x1)){
			x1 = x1.replace(freqFormatRgx, '$1' + tSeparator + '$2');
		}

		return x1 + x2 + ' ops/s';
	};

	function Test(name, testFunction){
		this._name = name;
		this._testFunction = testFunction;
		this.reset();
	}

	Test.prototype.reset = function(){
		this._metrics = new Metrics();
		this.data = {};
	};

	Test.prototype.run = function(){
		var ms,
			elapsed = 0,
			ops = 0;

		while(elapsed < 1000){
			ms = (new Date()).getTime();
			this._testFunction.call(this.data);
			elapsed += (new Date()).getTime() - ms;
			ops++;
		}

		this._metrics.record(ops, elapsed);
	};

	Test.prototype.getMetrics = function(){
		return this._metrics;
	};

	Test.prototype.getName = function(){
		return this._name;
	};

	/**
	 * @param Object options a configuration object, the following settings are available:
	 *  - Integer interval the time between a test run and the next one (to let the system/environment catch up)
	 *  - Integer testRuns how many times a test run should be repeated
	 */
	function Suite(options){
		options = options || {};
		EventGenerator.call(this);

		this._tests = [];
		this._running = false;
		this._ran = false;
		this._interval = (options.interval > 0) ? options.interval : 1000;
		this._testRuns = (options.testRuns > 0) ? options.testRuns : 3;
		this.reset();
	}

	Suite.prototype = new EventGenerator();

	Suite.prototype.reset = function(){
		if(!this._running){
			this._calibration = null;

			if(this._ran){
				var t = this._tests,
					x = 0,
					y = this._tests.length;

				for(; x < y; x++)
					t[x].reset();
			}
		}
	};

	Suite.prototype.add = function(name, testFunction){
		if(name instanceof Function){
			testFunction = name;
			name = undefined;
		}

		if(testFunction instanceof Function){
			if(!(typeof name == 'string') || !(name.length))
				name = 'Test ' + (this._tests.length + 1);

			this._tests.push(new Test(name, testFunction));
		}else
			throw new SuiteError('testFunction is not a function');
	};

	Suite.prototype.start = function(){
		if(!this._running){
			var t = this._tests,
				x = 0,
				y = this._tests.length,
				self = this,
				calTest = new Test('calibration', function(){}),
				c = 0,
				m,
				i;

			function calibrate(){
				if(c == 0)
					self.fireEvent('calibrating', self);

				if(c < 5){
					calTest.run();
					c++;
					setTimeout(calibrate, 100);
				}else{
					self._calibration = calTest.getMetrics();
					calTest = null;

					self.fireEvent('calibrated', self);
					setTimeout(process, 100);
				}
			}

			function process(){
				if(x < y){
					i = t[x];
					m = i.getMetrics();

					if(m.getRecordsCount() == 0)
						self.fireEvent('testing', i);

					if(self.setup instanceof Function)
						self.setup.call(i.data);

					i.run();
					self.fireEvent('test', i);

					if(self.teardown instanceof Function)
						self.teardown.call(i.data);

					if(m.getRecordsCount() == self._testRuns){
						x++;
						self.fireEvent('tested', i)
					}

					setTimeout(process, self._interval);
				}else{
					self._running = false;
					self.fireEvent('completed', self);
				}
			}

			this.reset();
			this._running = true;
			this._ran = true;
			this.fireEvent('started');
			setTimeout(calibrate, 100);
		}
	};

	Suite.prototype.getCalibrationMetrics = function(){
		return this._calibration;
	}

	function SuiteError(message){
		Error.call(this, message);
	}

	SuiteError.prototype = new Error();

	/** @public **/

	return {
		Test: Test,
		Suite: Suite,
		SuiteError: SuiteError
		/*
		 TODO: Profiling/quick benchmarking
		 registerFunction: registerFunction, (quick benchmarking)
		 unregisterFunction: unregisterFunction, (quick benchmarking)
		 Profiler: Profiler (with register/unregisterFunction and profileStart/End) see the following:

		 //http://yui.yahooapis.com/2.9.0/build/profiler/profiler.js
		 instrument: function(name, method){

		 //create instrumented version of function
		 var newMethod = function () {

		 var start = new Date(),
		 retval = method.apply(this, arguments),
		 stop = new Date();

		 saveDataPoint(name, stop-start);

		 return retval;

		 };

		 //copy the function properties over
		 lang.augmentObject(newMethod, method);

		 //assign prototype and flag as being profiled
		 newMethod.__yuiProfiled = true;
		 newMethod.prototype = method.prototype;

		 //store original method
		 container[name] = method;
		 container[name].__yuiFuncName = name;

		 //create the report
		 createReport(name);

		 //return the new method
		 return newMethod;
		 }
		 */
	};
})();