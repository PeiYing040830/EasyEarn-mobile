import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:easyearn_mobile/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late LocalSiteServer server;
  late HttpClient client;
  final testHttpOverrides = HttpOverrides.current;
  setUp(() async {
    // Exercise the real loopback asset server instead of Flutter's HTTP stub.
    HttpOverrides.global = null;
    server = await LocalSiteServer.start();
    client = HttpClient();
  });
  tearDown(() async {
    client.close(force: true);
    await server.close();
    HttpOverrides.global = testHttpOverrides;
  });
  test('bundled homepage and stylesheet are served without caching', () async {
    final response = await (await client.getUrl(server.homepage)).close();
    expect(response.statusCode, HttpStatus.ok);
    expect(response.headers.contentType?.mimeType, 'text/html');
    expect(response.headers.value(HttpHeaders.cacheControlHeader), 'no-store');
    final html = await response.transform(utf8.decoder).join();
    expect(html, contains('EasyEarn Job Matching Portal'));
    final css = await (await client.getUrl(server.homepage.resolve('/css/mobile-app.css'))).close();
    expect(css.statusCode, HttpStatus.ok);
    expect(css.headers.contentType?.mimeType, 'text/css');
    await css.drain<void>();
  });
  test('missing bundled assets return 404', () async {
    final response = await (await client.getUrl(server.homepage.resolve('/missing-qa-asset.html'))).close();
    expect(response.statusCode, HttpStatus.notFound);
    await response.drain<void>();
  });
}
