import 'dart:io';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final siteServer = await LocalSiteServer.start();
  runApp(EasyEarnApp(siteServer: siteServer));
}

class EasyEarnApp extends StatelessWidget {
  const EasyEarnApp({super.key, required this.siteServer});

  final LocalSiteServer siteServer;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EasyEarn',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.white,
      ),
      home: EasyEarnWebsite(siteServer: siteServer),
    );
  }
}

class LocalSiteServer {
  LocalSiteServer(this._server);

  final HttpServer _server;
  Uri get homepage =>
      Uri(scheme: 'http', host: '127.0.0.1', port: _server.port);

  static Future<LocalSiteServer> start() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8765);
    final localSiteServer = LocalSiteServer(server);
    server.listen(localSiteServer._serve);
    return localSiteServer;
  }

  Future<void> _serve(HttpRequest request) async {
    final segments = request.uri.pathSegments.where((part) => part.isNotEmpty);
    if (segments.any(
      (part) => part == '.' || part == '..' || part.contains('\\'),
    )) {
      request.response.statusCode = HttpStatus.badRequest;
      await request.response.close();
      return;
    }

    final relativePath = segments.isEmpty ? 'index.html' : segments.join('/');
    final assetPath = 'assets/site/$relativePath';
    try {
      final data = await rootBundle.load(assetPath);
      request.response.headers
        ..contentType = ContentType.parse(_contentType(relativePath))
        ..set(HttpHeaders.cacheControlHeader, 'no-store')
        ..set('Access-Control-Allow-Origin', '*');
      request.response.add(data.buffer.asUint8List());
    } on FlutterError {
      request.response.statusCode = HttpStatus.notFound;
    }
    await request.response.close();
  }

  String _contentType(String path) {
    switch (path.split('.').last.toLowerCase()) {
      case 'html':
        return 'text/html; charset=utf-8';
      case 'css':
        return 'text/css; charset=utf-8';
      case 'js':
      case 'mjs':
        return 'text/javascript; charset=utf-8';
      case 'json':
        return 'application/json; charset=utf-8';
      case 'svg':
        return 'image/svg+xml';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'woff':
        return 'font/woff';
      case 'woff2':
        return 'font/woff2';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> close() => _server.close(force: true);
}

class EasyEarnWebsite extends StatefulWidget {
  const EasyEarnWebsite({super.key, required this.siteServer});

  final LocalSiteServer siteServer;

  @override
  State<EasyEarnWebsite> createState() => _EasyEarnWebsiteState();
}

class _EasyEarnWebsiteState extends State<EasyEarnWebsite> {
  late final WebViewController _controller;
  bool _canGoBack = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('EasyEarnFiles', onMessageReceived: (message) async {
        try {
          final file = jsonDecode(message.message) as Map<String, dynamic>;
          await const MethodChannel('easyearn/files').invokeMethod('save', file);
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Unable to save the file. Please try again.')),
            );
          }
        }
      })
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) async {
            final canGoBack = await _controller.canGoBack();
            if (mounted) setState(() => _canGoBack = canGoBack);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri != null &&
                (uri.host == '127.0.0.1' ||
                    uri.host == 'localhost' ||
                    uri.host == 'fonts.googleapis.com' ||
                    uri.host == 'fonts.gstatic.com')) {
              return NavigationDecision.navigate;
            }
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(widget.siteServer.homepage);
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      platform.setOnShowFileSelector((params) async {
        final files = await const MethodChannel('easyearn/files')
            .invokeListMethod<String>('choose', {
              'types': params.acceptTypes,
              'multiple': params.mode == FileSelectorMode.openMultiple,
            });
        return files ?? <String>[];
      });
    }
  }

  @override
  void dispose() {
    widget.siteServer.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop && _canGoBack) await _controller.goBack();
      },
      child: Scaffold(
        body: SafeArea(
          child: WebViewWidget(
            controller: _controller,
            gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
              Factory<EagerGestureRecognizer>(() => EagerGestureRecognizer()),
            },
          ),
        ),
      ),
    );
  }
}
