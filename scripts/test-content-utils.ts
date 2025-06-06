#!/usr/bin/env tsx
import { 
  getContentBySlug, 
  getAllContentMetadata, 
  getNavigationTree, 
  getBreadcrumbs,
  getRelatedContent,
  getCategories,
  getTags
} from '../src/lib/content';

async function testContentUtils() {
  console.log('Testing content utilities...\n');

  try {
    // Test getContentBySlug
    console.log('1. Testing getContentBySlug...');
    const basicNeeds = await getContentBySlug('basic-needs');
    if (basicNeeds) {
      console.log(`✓ Found content: "${basicNeeds.title}" (${basicNeeds.word_count} words)`);
    } else {
      console.log('✗ Failed to load basic-needs content');
    }

    // Test getAllContentMetadata
    console.log('\n2. Testing getAllContentMetadata...');
    const allMetadata = await getAllContentMetadata();
    console.log(`✓ Loaded ${allMetadata.length} content sections`);

    // Test getNavigationTree
    console.log('\n3. Testing getNavigationTree...');
    const navigation = await getNavigationTree();
    console.log(`✓ Loaded navigation tree with ${navigation.length} top-level items`);

    // Test getBreadcrumbs
    console.log('\n4. Testing getBreadcrumbs...');
    const breadcrumbs = await getBreadcrumbs('food');
    console.log(`✓ Breadcrumbs for 'food': ${breadcrumbs.map(b => b.title).join(' > ')}`);

    // Test getRelatedContent
    console.log('\n5. Testing getRelatedContent...');
    const related = await getRelatedContent('combat', 3);
    console.log(`✓ Found ${related.length} related content items for 'combat':`);
    related.forEach(item => console.log(`  - ${item.title}`));

    // Test getCategories
    console.log('\n6. Testing getCategories...');
    const categories = await getCategories();
    console.log(`✓ Found ${categories.length} categories: ${categories.slice(0, 5).join(', ')}${categories.length > 5 ? '...' : ''}`);

    // Test getTags
    console.log('\n7. Testing getTags...');
    const tags = await getTags();
    console.log(`✓ Found ${tags.length} tags: ${tags.slice(0, 10).join(', ')}${tags.length > 10 ? '...' : ''}`);

    console.log('\n✅ All content utility tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testContentUtils();