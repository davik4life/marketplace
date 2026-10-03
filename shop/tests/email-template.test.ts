import {test} from 'node:test';
import assert from 'node:assert/strict';
import {welcomeHtml,receiptHtml} from '../lib/email-template.ts';
test('emails escape account and order data and use branded absolute links',()=>{
 const base='https://okirika-home.netlify.app';
 const welcome=welcomeHtml('<img src=x onerror=alert(1)>',base);
 assert.ok(welcome.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!welcome.includes('<img src=x'));
 assert.ok(welcome.includes(base+'/email/okirika-logo.png'));
 assert.ok(welcome.includes(base+'/#collection'));
 const receipt=receiptHtml({reference:'REF<1>',delivery:{name:'A & B',address:'<script>x</script>',city:'Lagos',state:'Lagos'},items:[{name:'Bowl <large>',quantity:2,price:1850000}],subtotal:3700000,shipping:250000,total:3950000},base);
 assert.ok(receipt.includes('Thank you for<br>your patronage!'));
 assert.ok(receipt.includes('₦39,500'));
 assert.ok(receipt.includes('Bowl &lt;large&gt;'));
 assert.ok(!receipt.includes('<script>'));
 assert.ok(receipt.includes(base+'/orders'));
});
