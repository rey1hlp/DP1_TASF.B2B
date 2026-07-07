package com.tasf_b2b.planificador.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BagCodeResolverTest {
    @Test
    void parsesBagCodeUsingLastHyphen() {
        BagCodeResolver.ParsedBagCode parsed = BagCodeResolver.parse("SPJC-00012345-002");

        assertEquals("SPJC-00012345", parsed.codigoPedido);
        assertEquals("SPJC-00012345-002", parsed.codigoMaleta);
        assertEquals(2, parsed.numeroMaleta);
    }

    @Test
    void rejectsInvalidBagCodes() {
        assertNull(BagCodeResolver.parse("SPJC-00012345"));
        assertNull(BagCodeResolver.parse("SPJC-00012345-0"));
        assertNull(BagCodeResolver.parse("SPJC-00012345-A"));
        assertNull(BagCodeResolver.parse(null));
    }

    @Test
    void validatesBagNumberAgainstShipmentQuantity() {
        assertTrue(BagCodeResolver.isValidBagNumber(1, 1));
        assertTrue(BagCodeResolver.isValidBagNumber(2, 3));
        assertFalse(BagCodeResolver.isValidBagNumber(4, 3));
        assertFalse(BagCodeResolver.isValidBagNumber(1, 0));
    }
}
